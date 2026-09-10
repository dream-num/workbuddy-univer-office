import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {importFile,ExchangeFormat} from '@univerjs-pro/exchange-node';
import {UniverInstanceType} from '@univerjs/core';

await test('XLSX projects filter visibility without changing source rows or revision',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'workbuddy-filter-export-'));
 const app=await startServer({workspace,port:0});
 const call=async(path,body)=>{const r=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
 try{
  const {fileId}=await call('/files',{file:'filter.univer'});
  const {worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
  const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'sheet',name:'Filter export'});
  const target={fileId,unitId,worktreeId,branch:'worktree'};
  const edit=await call('/content',{target,action:'execute',mode:'write',code:`
   const s=workbook.getActiveSheet();s.getRange('A1:B4').setValues([['Region','Amount'],['East',100],['West',200],['East',300]]);
   s.getRange('A1:B4').createFilter().setColumnFilterCriteria(0,{colId:0,filters:{filters:['East']}});
   s.hideRows(5,1);return s.getSheetId();
  `});
  assert.equal(edit.commit,'confirmed');
  const before=await call('/content',{target,action:'snapshot'});
  const exported=await call('/delivery',{target,action:'export',output:'filtered.xlsx'});
  assert.equal(exported.revision,before.revision);
  const imported=await importFile(join(workspace,'filtered.xlsx'),{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX});
  const sheet=imported.sheets[imported.sheetOrder[0]];
  assert.equal(sheet.rowData[2].hd,1,'Filtered West row must be hidden on initial open');
  assert.equal(sheet.rowData[5].hd,1,'Manual hide must survive export');
  assert.equal(sheet.cellData[2][0].v,'West','Filtered data must not be deleted');
  assert.ok(JSON.stringify(imported.resources).includes('East'),'Filter criterion must remain');
  assert.deepEqual(await call('/content',{target,action:'snapshot'}),before,'Export must not modify source');
  await call('/content',{target,action:'execute',mode:'write',code:`workbook.getActiveSheet().getFilter().removeFilterCriteria();return true;`});
  await call('/delivery',{target,action:'export',output:'cleared.xlsx'});
  const cleared=await importFile(join(workspace,'cleared.xlsx'),{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX});
  const clearSheet=cleared.sheets[cleared.sheetOrder[0]];
  assert.notEqual(clearSheet.rowData?.[2]?.hd,1,'Removing the filter must not leave a manual hide');
  assert.equal(clearSheet.rowData[5].hd,1);
 }finally{await app.close();}
});
