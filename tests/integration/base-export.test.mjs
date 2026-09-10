import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {importFile,ExchangeFormat} from '@univerjs-pro/exchange-node';
import {UniverInstanceType} from '@univerjs/core';

await test('Base export respects table/view selection, order, visibility and confirmed revision',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'workbuddy-base-export-'));
 const app=await startServer({workspace,port:0});
 const request=async(path,body)=>{const r=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const call=async(path,body)=>{const r=await request(path,body);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 try{
  const {fileId}=await call('/files',{file:'views.univer'});
  const {worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
  const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'base',name:'导出视图验证'});
  const target={fileId,unitId,worktreeId,branch:'worktree'};
  const edit=await call('/content',{target,action:'execute',mode:'write',code:`
   const table=base.insertTable('Tasks',{primaryFieldName:'Task'});
   const score=table.addField('Score',api.Enum.BaseFieldType.Number);
   const status=table.addField('Status',api.Enum.BaseFieldType.Text);
   const secret=table.addField('Internal',api.Enum.BaseFieldType.Text);
   table.addRecords([['Low',2,'keep','private-low'],['Excluded',99,'drop','private-drop'],['High',7,'keep','private-high']].map(row=>({values:{[table.getPrimaryFieldId()]:row[0],[score.getId()]:row[1],[status.getId()]:row[2],[secret.getId()]:row[3]}})));
   const view=table.getViews()[0];
   view.setFieldVisible(secret.getId(),false);
   view.moveField(status.getId(),{afterFieldId:table.getPrimaryFieldId()});
   view.setFilter({conjunction:api.Enum.BaseFilterConjunction.AND,conditions:[{fieldId:status.getId(),operator:api.Enum.BaseFilterOperator.IS,operand:'keep'}]});
   view.setSort([{fieldId:score.getId(),direction:api.Enum.BaseSortDirection.DESC}]);
   const empty=table.createView('Empty',api.Enum.BaseViewType.Grid);
   empty.setFilter({conjunction:api.Enum.BaseFilterConjunction.AND,conditions:[{fieldId:status.getId(),operator:api.Enum.BaseFilterOperator.IS,operand:'never'}]});
   const other=base.insertTable('Other',{primaryFieldName:'OtherSecret'});
   other.addRecords([{values:{[other.getPrimaryFieldId()]:'other-table-private'}}]);
   return {tableId:table.getId(),viewId:view.getId(),emptyViewId:empty.getId()};
  `});
  assert.equal(edit.commit,'confirmed');
  const {tableId,viewId,emptyViewId}=edit.value;
  for(const extension of ['csv','tsv','xlsx']){
   const output=`view.${extension}`;
   const exported=await call('/delivery',{target,action:'export',output,baseSelection:{tableId,viewId}});
   assert.equal(exported.revision,edit.revision);assert.equal(exported.recordCount,2);
   if(extension==='xlsx'){
    const book=await importFile(join(workspace,output),{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX});
    assert.equal(book.sheetOrder.length,1);
    const cells=book.sheets[book.sheetOrder[0]].cellData;
    assert.deepEqual([0,1,2].map(r=>[0,1,2].map(c=>String(cells[r]?.[c]?.v))),[['Task','Status','Score'],['High','keep','7'],['Low','keep','2']]);
    assert.ok(!JSON.stringify(book).includes('private'));
   }else{
    const text=(await readFile(join(workspace,output),'utf8')).replace(/^\uFEFF/,'').trim();
    const delimiter=extension==='csv'?',':'\t';
    assert.deepEqual(text.split(/\r?\n/).map(line=>line.split(delimiter)),[['Task','Status','Score'],['High','keep','7'],['Low','keep','2']]);
   }
  }
  const table=await call('/delivery',{target,action:'export',output:'table.csv',baseSelection:{tableId}});assert.equal(table.recordCount,3);
  assert.ok((await readFile(join(workspace,'table.csv'),'utf8')).includes('private-drop'));
  const empty=await call('/delivery',{target,action:'export',output:'empty.csv',baseSelection:{tableId,viewId:emptyViewId}});assert.equal(empty.recordCount,0);
  assert.equal((await readFile(join(workspace,'empty.csv'),'utf8')).trim().split(/\r?\n/).length,1);
  for(const baseSelection of [undefined,{tableId:'missing'},{tableId,viewId:'missing'}])assert.notEqual((await request('/delivery',{target,action:'export',output:'invalid.csv',baseSelection})).status,200);
  assert.equal((await request('/delivery',{target,action:'export',output:'view.csv',baseSelection:{tableId,viewId}})).data.code,'OUTPUT_EXISTS');
  const after=await call('/content',{target,action:'snapshot'});assert.equal(after.revision,edit.revision);assert.equal(Object.keys(after.unitData.tables).length,2);
  await call('/content',{target,action:'execute',mode:'write',code:`base.getTableById(${JSON.stringify(tableId)}).addField('Needs representation check',api.Enum.BaseFieldType.Checkbox);return true;`});
  const unsupported=await request('/delivery',{target,action:'export',output:'unsupported.xlsx',baseSelection:{tableId}});
  assert.notEqual(unsupported.status,200);assert.match(unsupported.data.message,/not yet verified/);
  console.log('Base export fixture:',workspace);
 }finally{await app.close();}
});
