import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {collaborationUrls} from '../../dist/shared/urls.js';
import {createCollaborationServerAdapter} from '@univer-cli/univer-collaboration-runtime';
import {UniverInstanceType} from '@univerjs/core';
import {UnitAction} from '@univerjs/protocol';
import {partialMergeFixture} from '../fixtures/partial-merge.mjs';

test('confirmed merge enables scoped trunk editing, never worktree editing',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-merge-edit-'));
 const app=await startServer({workspace,port:0}),handles=[];
 try{
  const file=await app.office.open('merge-edit.univer',true),fileId=file.catalog.fileId;
  const draft=await app.office.createWorktree(fileId,[]),worktreeId=draft.worktreeID;
  const units=[];for(const kind of ['sheet','doc','slide','base','board'])units.push(await app.office.createUnit(fileId,worktreeId,kind,kind));
  const launch=await fetch(app.launchUrl,{redirect:'manual'}),cookie=launch.headers.get('set-cookie').split(';')[0];
  const post=async(path,body,headers={cookie})=>{const response=await fetch(app.origin+path,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  const target={fileId,unitId:units[0].unitId,branch:'worktree',worktreeId};
  assert.equal((await post('/api/edit-sessions',{target,confirmed:true})).data.code,'WORKTREE_READ_ONLY');
  await app.office.action(fileId,worktreeId,'ready','agent');
  assert.equal((await post('/api/edit-sessions',{target,confirmed:true})).data.code,'WORKTREE_READ_ONLY');
  const review=await app.office.reviewState(fileId,worktreeId);
  assert.equal((await post(`/api/files/${fileId}/review/${worktreeId}`,{action:'merge',fingerprint:'stale'})).data.code,'STALE_REVIEW');
  assert.equal((await post(`/api/files/${fileId}/review/${worktreeId}`,{action:'merge',fingerprint:review.fingerprint})).data.worktree.status,'merged');
  const grants=[];
  for(const unit of units){
   const trunk={fileId,unitId:unit.unitId,branch:'trunk'};
   assert.equal((await post('/api/edit-sessions',{target:trunk,confirmed:false})).status,400);
   assert.equal((await post('/api/edit-sessions',{target:trunk,confirmed:true},{authorization:`Bearer ${app.agentToken}`})).status,403);
   const grant=await post('/api/edit-sessions',{target:trunk,confirmed:true});assert.equal(grant.status,200);assert.deepEqual(grant.data.target,trunk);grants.push(grant.data);
   const request={requests:units.map(u=>({unitID:u.unitId,objectID:u.unitId,actions:[UnitAction.View,UnitAction.Edit]}))};
   const permissions=await post(`/api/files/${fileId}/permissions/trunk/-/object/-/batch_allowed?editSession=${grant.data.token}`,request);
   assert.deepEqual(permissions.data.objectActions.map(o=>o.actions[1].allowed),units.map(u=>u.unitId===unit.unitId));
  }
  assert.equal((await app.office.status(fileId)).worktrees.length,1,'editing must not create another worktree');
  const grant=grants[0];
  const makeBackend=(branch,token)=>createCollaborationServerAdapter({...Object.fromEntries(Object.entries(collaborationUrls(app.origin,fileId,branch)).map(([key,value])=>{const url=new URL(value);if(token)url.pathname=`/edit/${token}${url.pathname}`;return [key,url.href];})),httpRequest:(url,init)=>fetch(url,{...init,headers:{...init?.headers,cookie}})});
  const handle=await makeBackend(undefined,grant.token).open({unitId:target.unitId,unitType:UniverInstanceType.UNIVER_SHEET});handles.push(handle);
  const mutation={id:'sheet.mutation.set-range-values',data:JSON.stringify({unitId:target.unitId,subUnitId:'data',cellValue:{0:{0:{v:'edited after merge',t:1}}}})};
  const result=await handle.submitChangeset({baseRev:1,mutations:[mutation],sid:'merge-edit-test',reqId:1});assert.equal(result.status,'confirmed',JSON.stringify(result));
  const read=await post('/api/content',{target:grant.target,action:'execute',mode:'read',code:"return workbook.getActiveSheet().getRange('A1').getValue();"},{authorization:`Bearer ${app.agentToken}`});assert.equal(read.data.value,'edited after merge');
  const newDraft=await app.office.createWorktree(fileId,[target.unitId]);
  const draftHandle=await makeBackend(newDraft.worktreeID,grant.token).open({unitId:target.unitId,unitType:UniverInstanceType.UNIVER_SHEET});handles.push(draftHandle);
  const denied=await draftHandle.submitChangeset({baseRev:1,mutations:[mutation],sid:'worktree-denied',reqId:2});assert.equal(denied.status,'rejected');assert.equal(denied.reason,'permission-denied');
  await post('/api/edit-sessions/revoke',{token:grant.token});
  const revoked=await handle.submitChangeset({baseRev:2,mutations:[mutation],sid:'revoked',reqId:3});assert.equal(revoked.status,'rejected');
 }finally{await Promise.allSettled(handles.map(h=>h.close()));await app.close();await rm(workspace,{recursive:true,force:true});}
});

test('partial merge does not enable editing before the complete merge succeeds',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-partial-edit-')),app=await startServer({workspace,port:0});
 try{
  const f=await partialMergeFixture(app),review=await app.office.reviewState(f.fileId,f.worktreeId);
  const result=await app.office.action(f.fileId,f.worktreeId,'merge','viewer',review.fingerprint);assert.equal(result.outcome,'partial');
  const launch=await fetch(app.launchUrl,{redirect:'manual'}),cookie=launch.headers.get('set-cookie').split(';')[0];
  const response=await fetch(app.origin+'/api/edit-sessions',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({target:{fileId:f.fileId,unitId:f.units[0].unitId,branch:'trunk'},confirmed:true})});
  assert.equal(response.status,403);assert.equal((await response.json()).code,'MERGE_REQUIRED');
 }finally{await app.close();await rm(workspace,{recursive:true,force:true});}
});
