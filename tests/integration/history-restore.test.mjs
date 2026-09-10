import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {runContent} from '../../dist/application/content-worker.js';

await test('restore requires a live scoped edit grant and retains stale-review and crash-recovery protection',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-restore-review-'));let app=await startServer({workspace,port:0});
 try{
  const file=await app.office.open('restore.univer',true),fileId=file.catalog.fileId;
  let draft=await app.office.createWorktree(fileId);
  const unit=await app.office.createUnit(fileId,draft.worktreeID,'sheet','Restore test'),unitId=unit.unitId;
  const edit=async(value)=>{
   const target={fileId,unitId,branch:'worktree',worktreeId:draft.worktreeID};
   const r=await runContent({origin:app.origin,credential:app.agentToken,target,kind:'sheet',action:'execute',mode:'write',code:`workbook.getActiveSheet().getRange('A1').setValue(${value});return true;`});assert.equal(r.commit,'confirmed');
   await app.office.action(fileId,draft.worktreeID,'ready','agent');const review=await app.office.reviewState(fileId,draft.worktreeID);
   await app.office.action(fileId,draft.worktreeID,'merge','viewer',review.fingerprint);
  };
  await edit(20);draft=await app.office.createWorktree(fileId,[unitId]);await edit(42);
  let cookie=(await fetch(app.launchUrl,{redirect:'manual'})).headers.get('set-cookie').split(';')[0];
  let editToken='';
  const enableEditing=async()=>{
   const response=await fetch(app.origin+'/api/edit-sessions',{method:'POST',headers:{'content-type':'application/json',Cookie:cookie},body:JSON.stringify({target:{fileId,unitId,branch:'trunk'},confirmed:true})});
   assert.equal(response.status,200);editToken=(await response.json()).token;
  };
  const post=async(action,body,agent=false,token=editToken)=>{const r=await fetch(`${app.origin}/api/files/${fileId}/history/${action}${!agent&&token?'?editSession='+token:''}`,{method:'POST',headers:{'content-type':'application/json',...(agent?{Authorization:`Bearer ${app.agentToken}`}:{Cookie:cookie})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  const read=()=>runContent({origin:app.origin,credential:app.agentToken,target:{fileId,unitId,branch:'trunk'},kind:'sheet',action:'execute',mode:'read',code:"return workbook.getActiveSheet().getRange('A1').getValue();"});
  const preview=new URL(await app.createPreview({fileId,unitId,branch:'trunk'}));
  const previewDenied=await fetch(`${preview.origin}${preview.pathname}api/files/${fileId}/history/prepare`,{method:'POST',headers:{'content-type':'application/json',Cookie:cookie},body:JSON.stringify({unitId,revision:1})});assert.equal(previewDenied.status,403);
  assert.equal((await post('list',{unitId},true)).status,403);
  const history=await post('list',{unitId});assert.equal(history.status,200);assert.equal(history.body.versions[0].revision,2);assert.equal(history.body.unitName,'Restore test');assert.equal(history.body.currentRevision,2);
  assert.equal((await post('prepare',{unitId,revision:1},true)).status,403);
  assert.equal((await post('prepare',{unitId,revision:1})).body.code,'EDIT_REQUIRED');
  await enableEditing();
  const otherDraft=await app.office.createWorktree(fileId,[]);
  const other=await app.office.createUnit(fileId,otherDraft.worktreeID,'doc','Other content');
  assert.equal((await post('prepare',{unitId:other.unitId,revision:1})).body.code,'EDIT_REQUIRED');
  assert.equal((await post('list',{unitId:other.unitId})).status,403);
  assert.equal((await post('prepare',{unitId,revision:2})).body.code,'INVALID_HISTORY_REVISION');
  const cancelled=await post('prepare',{unitId,revision:1});assert.equal(cancelled.status,200);
  assert.equal((await post('cancel',{operationId:cancelled.body.operationId},true)).status,403);
  assert.equal((await post('cancel',{operationId:cancelled.body.operationId})).body.outcome,'cancelled');
  assert.equal((await post('cancel',{operationId:cancelled.body.operationId})).body.outcome,'cancelled');
  assert.equal((await post('confirm',{operationId:cancelled.body.operationId})).body.code,'RESTORE_CANCELLED');
  const prepared=await post('prepare',{unitId,revision:1});assert.equal(prepared.status,200);assert.equal(prepared.body.expectedRevision,2);
  assert.equal((await post('confirm',{operationId:prepared.body.operationId},true)).status,403);
  assert.equal((await post('confirm',{operationId:prepared.body.operationId,revision:2})).status,400);
  assert.equal((await read()).value,42);
  assert.equal((await post('confirm',{operationId:prepared.body.operationId},false,'')).body.code,'EDIT_REQUIRED');
  assert.equal((await post('cancel',{operationId:prepared.body.operationId},false,'')).body.code,'EDIT_REQUIRED');
  await fetch(app.origin+'/api/edit-sessions/revoke',{method:'POST',headers:{'content-type':'application/json',Cookie:cookie},body:JSON.stringify({token:editToken})});
  assert.equal((await post('confirm',{operationId:prepared.body.operationId})).status,401);
  assert.equal((await read()).value,42);
  await enableEditing();
  const confirmed=await post('confirm',{operationId:prepared.body.operationId});assert.equal(confirmed.status,200);assert.equal(confirmed.body.revision,3);assert.equal((await read()).value,20);
  assert.deepEqual((await post('confirm',{operationId:prepared.body.operationId})).body,confirmed.body);
  assert.equal((await post('cancel',{operationId:prepared.body.operationId})).body.code,'RESTORE_NOT_CANCELLABLE');
  // Simulate a crash after SDK commit but before saving the application receipt.
  const record=file.catalog.get('history-restore',prepared.body.operationId);record.status='submitting';delete record.resultRevision;file.catalog.put('history-restore',record.operationId,record);
  await app.close();app=await startServer({workspace,port:0});cookie=(await fetch(app.launchUrl,{redirect:'manual'})).headers.get('set-cookie').split(';')[0];
  assert.equal((await post('confirm',{operationId:prepared.body.operationId})).status,401,'restart invalidates edit grants');
  await enableEditing();
  assert.equal((await post('confirm',{operationId:cancelled.body.operationId})).body.code,'RESTORE_CANCELLED');
  assert.deepEqual((await post('confirm',{operationId:prepared.body.operationId})).body,confirmed.body);assert.equal((await app.office.file(fileId).service.getUnitLoadData({unitID:unitId,type:record.request.type,revision:0},{userID:'application'})).targetRevision,3);
  const stale=await post('prepare',{unitId,revision:2});assert.equal(stale.status,200);
  draft=await app.office.createWorktree(fileId,[unitId]);await edit(99);
  assert.equal((await post('confirm',{operationId:stale.body.operationId})).body.code,'STALE_REVIEW');assert.equal((await read()).value,99);
  const expired=await post('prepare',{unitId,revision:1});assert.equal(expired.status,200);
  const expiredRecord=app.office.file(fileId).catalog.get('history-restore',expired.body.operationId);expiredRecord.createdAt-=16*60_000;app.office.file(fileId).catalog.put('history-restore',expiredRecord.operationId,expiredRecord);
  assert.equal((await post('confirm',{operationId:expiredRecord.operationId})).body.code,'RESTORE_EXPIRED');assert.equal((await read()).value,99);

 }finally{await app.close();}
});
