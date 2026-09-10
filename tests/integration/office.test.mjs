import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {UnitAction} from '@univerjs/protocol';

const workspace=await mkdtemp(join(tmpdir(),'workbuddy-office-test-'));
let app=await startServer({workspace,port:0});
async function request(path,body,token=app.agentToken){
 const response=await fetch(app.origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 return{status:response.status,data:await response.json()};
}
let fileId,worktreeId,unitId;
const units={};
try {
 await test('workspace boundary, authentication and create without overwrite',async()=>{
  assert.equal((await request('/files',undefined,'invalid')).status,401);
  assert.equal((await request('/files',{file:'../escape.univer'})).data.code,'OUTSIDE_WORKSPACE');
  const created=await request('/files',{file:'verified.univer'});assert.equal(created.status,200);fileId=created.data.fileId;
  assert.equal((await request('/files',{file:'verified.univer'})).data.code,'FILE_EXISTS');
  worktreeId=(await request(`/files/${fileId}/worktrees`,{})).data.worktreeID;
 });
 await test('all five SDK Unit models create and inspect',async()=>{
  for(const [kind,query]of [['sheet','workbook'],['doc','document'],['slide','presentation'],['base','base'],['board','board']]){
   const created=await request(`/files/${fileId}/units`,{worktreeId,kind,name:`Test ${kind}`});assert.equal(created.status,200,JSON.stringify(created.data));
   if(kind==='sheet')unitId=created.data.unitId;
   units[kind]=created.data.unitId;
   const inspected=await request('/content',{target:{fileId,unitId:created.data.unitId,branch:'worktree',worktreeId},action:'inspect',query:{kind:query}});
   assert.equal(inspected.status,200,`${kind}: ${JSON.stringify(inspected.data)}`);assert.equal(inspected.data.kind,query);
  }
 });
 const target={fileId,unitId,branch:'worktree',worktreeId};
 await test('new Doc accepts rich text and table edits; new Board accepts text and reloads',async()=>{
  for(const [kind,code,read,expected]of [
   ['doc',`doc.appendParagraph('中文实施说明').getTextRange().setTextStyle({fs:18,bl:1});if(!doc.insertTableFromData([['检查项','结果'],['保存','通过']],{headerRowCount:1}))throw Error('Table failed');return true;`,`return doc.getBody();`,'中文实施说明'],
   ['board',`board.insertText({left:20,top:20,text:'草稿协作验证'});return true;`,`return JSON.parse(JSON.stringify(board.save()));`,'草稿协作验证'],
  ]){
   const selected={...target,unitId:units[kind]};
   const edited=await request('/content',{target:selected,action:'execute',mode:'write',code});assert.equal(edited.data.commit,'confirmed',JSON.stringify(edited));
   const loaded=await request('/content',{target:selected,action:'execute',mode:'read',code:read});assert.equal(loaded.status,200,JSON.stringify(loaded));assert.ok(JSON.stringify(loaded.data.value).includes(expected));
  }
 });
 await test('write confirmed, formula result available on reloaded read, read cannot mutate',async()=>{
  const result=await request('/content',{target,action:'execute',mode:'write',code:`workbook.getActiveSheet().getRange('A1:B2').setValues([[20,30],['=SUM(A1:B1)',50]]);return true;`});
  assert.equal(result.data.commit,'confirmed',JSON.stringify(result));assert.equal(result.data.revision,2);
  const read=await request('/content',{target,action:'execute',mode:'read',code:`return workbook.getActiveSheet().getRange('A2').getValue();`});assert.equal(read.data.value,50);
  const invalid=await request('/content',{target,action:'execute',mode:'read',code:`workbook.getActiveSheet().getRange('A1').setValue(999);`});assert.equal(invalid.status,400);
  const intact=await request('/content',{target,action:'execute',mode:'read',code:`return workbook.getActiveSheet().getRange('A1').getValue();`});assert.equal(intact.data.value,20);
 });
 await test('no-op creates no revision; ready freezes writes; Agent cannot merge',async()=>{
  const noop=await request('/content',{target,action:'execute',mode:'write',code:'return 1;'});assert.equal(noop.data.commit,'nothing-to-commit');assert.equal(noop.data.revision,2);
  const ready=await request(`/files/${fileId}/review/${worktreeId}`,{action:'ready'});assert.equal(ready.data.worktree.status,'ready');
  const permissions=await request(`/files/${fileId}/permissions/${worktreeId}/-/object/-/batch_allowed`,{requests:Object.values(units).map(id=>({unitID:id,objectID:id,actions:[UnitAction.View,UnitAction.Edit]}))});
  assert.equal(permissions.status,200);
  assert.equal(permissions.data.objectActions.length,5);
  for(const item of permissions.data.objectActions){
   assert.equal(item.actions.find(a=>a.action===UnitAction.View).allowed,true);
   assert.equal(item.actions.find(a=>a.action===UnitAction.Edit).allowed,false);
  }
  const frozen=await request('/content',{target,action:'execute',mode:'write',code:'return 1;'});assert.equal(frozen.data.code,'WORKTREE_FROZEN');
  const pending=await request(`/files/${fileId}/review/${worktreeId}`,{action:'merge',approved:true});assert.equal(pending.data.outcome,'pending-review');
  const direct=await fetch(`${app.origin}/files/${fileId}/universer-api/worktrees/${worktreeId}/merge`,{method:'POST',headers:{Authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:'{}'});assert.notEqual(direct.status,200);
 });
 await test('explicit current review merges, trunk denies Agent writes',async()=>{
  const launch=await fetch(app.launchUrl,{redirect:'manual'});const cookie=launch.headers.get('set-cookie').split(';')[0];
  const state=(await request(`/files/${fileId}/review/${worktreeId}`)).data;
  const stale=await fetch(`${app.origin}/api/files/${fileId}/review/${worktreeId}`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({action:'merge',fingerprint:'old'})});assert.equal((await stale.json()).code,'STALE_REVIEW');
  const merged=await fetch(`${app.origin}/api/files/${fileId}/review/${worktreeId}`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({action:'merge',fingerprint:state.fingerprint})});const result=await merged.json();assert.equal(result.worktree.status,'merged',JSON.stringify(result));
  const trunk=await request('/content',{target:{fileId,unitId,branch:'trunk'},action:'execute',mode:'write',code:'return 1;'});assert.equal(trunk.data.code,'TRUNK_WRITE_DENIED');
  const historyPermissions={requests:Object.values(units).map(id=>({unitID:id,objectID:id,actions:[UnitAction.ViewHistory,UnitAction.RecoverHistory]}))};
  const readPermissions=async(branch,headers)=>{
   const response=await fetch(`${app.origin}/api/files/${fileId}/permissions/${branch}/-/object/-/batch_allowed`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(historyPermissions)});
   assert.equal(response.status,200);return (await response.json()).objectActions;
  };
  for(const row of await readPermissions('trunk',{cookie}))assert.deepEqual(row.actions.map(a=>a.allowed),[true,false]);
  for(const row of await readPermissions(worktreeId,{cookie}))assert.deepEqual(row.actions.map(a=>a.allowed),[false,false]);
  for(const row of await readPermissions('trunk',{Authorization:`Bearer ${app.agentToken}`}))assert.deepEqual(row.actions.map(a=>a.allowed),[false,false]);
 });
 await test('restart recovers all Units and merged state; XLSX and CSV export are nonempty',async()=>{
  const histories={};
  for(const [kind,id] of Object.entries(units)){
   const history=await app.office.file(fileId).history.getHistoryList({unitID:id,length:100},{userID:'viewer'});
   assert.ok(history.historyIds.length>0,`${kind}: merged Unit has no history`);
   for(const historyId of history.historyIds){
    const entry=history.entities.datas[historyId];
    assert.equal(entry.unitID,id);assert.ok(entry.startRevision>=1);assert.ok(entry.endRevision>=entry.startRevision);
   }
   histories[kind]=history;
  }
  await app.close();app=await startServer({workspace,port:0});
  const state=await request(`/files/${fileId}`);assert.equal(state.data.units.length,5);assert.equal(state.data.worktrees[0].status,'merged');
  for(const [kind,id] of Object.entries(units)){
   const recovered=await app.office.file(fileId).history.getHistoryList({unitID:id,length:100},{userID:'viewer'});
   assert.deepEqual(recovered,histories[kind],`${kind}: persisted history changed across restart`);
  }
  for(const extension of ['xlsx','csv']){
   const exported=await request('/delivery',{target:{fileId,unitId,branch:'trunk'},action:'export',output:`result.${extension}`});assert.equal(exported.status,200,JSON.stringify(exported));
   const bytes=await readFile(join(workspace,`result.${extension}`));assert.ok(bytes.length>10);
   const duplicate=await request('/delivery',{target:{fileId,unitId,branch:'trunk'},action:'export',output:`result.${extension}`});assert.notEqual(duplicate.status,200);
  }
 });
} finally {await app.close();}
console.log('Fixture workspace:',workspace);
