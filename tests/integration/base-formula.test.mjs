import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {importFile,ExchangeFormat} from '@univerjs-pro/exchange-node';
import {UniverInstanceType} from '@univerjs/core';
import {selectBaseExport} from '../../dist/application/base-export.js';

await test('Base formula values survive view export with hidden dependencies',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'workbuddy-base-formula-'));
 console.log('Base formula fixture:',workspace);
 const app=await startServer({workspace,port:0});
 const call=async(path,body)=>{const r=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
 try{
  const {fileId}=await call('/files',{file:'formula.univer'});
  const {worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
  const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'base',name:'Formula delivery'});
  const target={fileId,unitId,worktreeId,branch:'worktree'};
  const edit=await call('/content',{target,action:'execute',mode:'write',code:`
   const table=base.insertTable('Items',{primaryFieldName:'Item'});
   const amount=table.addField('Amount',api.Enum.BaseFieldType.Number);
   const count=table.addField('Count',api.Enum.BaseFieldType.Number);
   const status=table.addField('Status',api.Enum.BaseFieldType.Text);
   const formulaName=table.getFormulaName();
   const total=table.addField('Total',api.Enum.BaseFieldType.Formula,{field:{config:{formula:'='+formulaName+'[[#This Row],[Amount]]*'+formulaName+'[[#This Row],[Count]]'}},externalReferences:[]});
   table.addField('Label',api.Enum.BaseFieldType.Formula,{field:{config:{formula:'=CONCAT("Total ",'+formulaName+'[[#This Row],[Total]])'}},externalReferences:[]});
   table.addField('Small',api.Enum.BaseFieldType.Formula,{field:{config:{formula:'='+formulaName+'[[#This Row],[Total]]<10'}},externalReferences:[]});
   table.addRecords([['Low',4,2,'keep'],['Excluded',999,9,'drop'],['High',7,3,'keep']].map(row=>({values:{[table.getPrimaryFieldId()]:row[0],[amount.getId()]:row[1],[count.getId()]:row[2],[status.getId()]:row[3]}})));
   const view=table.getViews()[0];
   view.setFieldVisible(amount.getId(),false);view.setFieldVisible(count.getId(),false);view.setFieldVisible(status.getId(),false);
   view.setFilter({conjunction:api.Enum.BaseFilterConjunction.AND,conditions:[{fieldId:status.getId(),operator:api.Enum.BaseFilterOperator.IS,operand:'keep'}]});
   view.setSort([{fieldId:total.getId(),direction:api.Enum.BaseSortDirection.DESC}]);
   await api.getFormula().onCalculationResultApplied(10000);
   return {tableId:table.getId(),viewId:view.getId(),totalId:total.getId()};
  `});
  assert.equal(edit.commit,'confirmed');
  const before=await call('/content',{target,action:'snapshot'});
  await writeFile(join(workspace,'source.json'),JSON.stringify(before,null,2));
  const {tableId,viewId,totalId}=edit.value;
  const table=before.unitData.tables[tableId];
  const values=(table.recordOrder??Object.keys(table.records)).map(id=>table.cellData[table.rowIndex[id]][table.colIndex[totalId]].v);
  assert.deepEqual(values,[8,8991,21]);
  for(const format of ['xlsx','csv','tsv']){
   const result=await call('/delivery',{target,action:'export',output:`formula.${format}`,baseSelection:{tableId,viewId}});
   assert.equal(result.revision,before.revision);assert.equal(result.recordCount,2);
   if(format==='xlsx'){
    const book=await importFile(join(workspace,'formula.xlsx'),{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX});
    const cells=book.sheets[book.sheetOrder[0]].cellData;
    assert.deepEqual([0,1,2].map(r=>[0,1,2,3].map(c=>String(cells[r]?.[c]?.v))),[['Item','Total','Label','Small'],['High','21','Total 21','FALSE'],['Low','8','Total 8','TRUE']]);
    assert.ok(!JSON.stringify(book).includes('8991'));
   }else{
    const csv=(await readFile(join(workspace,`formula.${format}`),'utf8')).replace(/^\uFEFF/,'').trim();
    assert.deepEqual(csv.split(/\r?\n/).map(line=>line.split(format==='csv'?',':'\t')),[['Item','Total','Label','Small'],['High','21','Total 21','FALSE'],['Low','8','Total 8','TRUE']]);
   }
  }
  const after=await call('/content',{target,action:'snapshot'});assert.deepEqual(after,before);
  // An imported/uncomputed snapshot must not silently produce an empty formula result.
  const incomplete=structuredClone(before.unitData);
  const recordId=table.recordOrder[0];
  const cell=incomplete.tables[tableId].cellData[table.rowIndex[recordId]][table.colIndex[totalId]];
  delete cell.v;
  assert.throws(()=>selectBaseExport(incomplete,{tableId,viewId},{fieldIds:[table.primaryFieldId,totalId],recordIds:[recordId]}),{code:'BASE_FORMULA_RESULT_MISSING'});
  cell.v=0;
  assert.equal(selectBaseExport(incomplete,{tableId,viewId},{fieldIds:[table.primaryFieldId,totalId],recordIds:[recordId]}).recordCount,1);
 }finally{await app.close();}
});
