import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {runContent} from '../../dist/application/content-worker.js';

test('comparisons retain pinned snapshots, detect changed sources, and reject closed or identical drafts',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-compare-freshness-'));let app=await startServer({workspace,port:0});
 try{
  const file=await app.office.open('comparison.univer',true),fileId=file.catalog.fileId;
  const seed=await app.office.createWorktree(fileId,[]);
  const {unitId}=await app.office.createUnit(fileId,seed.worktreeID,'sheet','Compare');
  await app.office.action(fileId,seed.worktreeID,'ready','agent');
  await app.office.action(fileId,seed.worktreeID,'merge','viewer',(await app.office.reviewState(fileId,seed.worktreeID)).fingerprint);
  const left=await app.office.createWorktree(fileId,[unitId]),right=await app.office.createWorktree(fileId,[unitId]);
  const target={fileId,unitId,branch:'worktree',worktreeId:right.worktreeID};
  const edit=async(worktreeId,value)=>{
   const result=await runContent({origin:app.origin,credential:app.agentToken,target:{...target,worktreeId},kind:'sheet',action:'execute',mode:'write',code:`workbook.getActiveSheet().getRange('A1').setValue(${value});return true;`});assert.equal(result.commit,'confirmed');
  };
  await edit(left.worktreeID,10);await edit(right.worktreeID,20);
  const request=async(path,body)=>{const response=await fetch(app.origin+'/api'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
  const initial=await request('/comparisons',{target});assert.equal(initial.status,200);
  const path=`/files/${fileId}/comparisons/${initial.data.comparisonId}`;
  const fixedPage=await request(path+'/pages?offset=0&contextOffset=0');assert.equal(fixedPage.status,200);
  assert.equal((await request(path+'/freshness')).data.changed,false);
  await edit(right.worktreeID,21);
  assert.deepEqual((await request(path+'/pages?offset=0&contextOffset=0')).data,fixedPage.data,'paging reads stored snapshots even when live heads advance');
  assert.equal((await request(path+'/freshness')).data.changed,true);
  assert.deepEqual((await request(path)).data,initial.data,'checking freshness must not replace either pinned snapshot');
  const refreshed=await request('/comparisons',{target});assert.equal(refreshed.status,200);
  assert.notEqual(refreshed.data.comparisonId,initial.data.comparisonId);assert.ok(refreshed.data.right.revision>initial.data.right.revision);
  const alternate=await request('/comparisons',{target,leftWorktreeId:left.worktreeID});assert.equal(alternate.status,200);assert.equal(alternate.data.leftTarget.worktreeId,left.worktreeID);
  const alternatePath=`/files/${fileId}/comparisons/${alternate.data.comparisonId}`;
  assert.equal((await request(alternatePath+'/freshness')).data.changed,false);
  await edit(left.worktreeID,11);assert.equal((await request(alternatePath+'/freshness')).data.changed,true);
  assert.deepEqual((await request(alternatePath)).data,alternate.data);
  assert.equal((await request('/comparisons',{target,leftWorktreeId:right.worktreeID})).data.code,'SAME_COMPARISON_SOURCE');
  await app.office.action(fileId,left.worktreeID,'discard','viewer',(await app.office.reviewState(fileId,left.worktreeID)).fingerprint);
  assert.equal((await request(alternatePath+'/freshness')).data.code,'COMPARISON_SOURCE_CLOSED');
  assert.equal((await request('/comparisons',{target,leftWorktreeId:left.worktreeID})).data.code,'COMPARISON_SOURCE_CLOSED');
  await app.close();app=await startServer({workspace,port:0});
  assert.deepEqual((await request(path)).data,initial.data,'pinned comparison survives restart unchanged');
 }finally{await app.close();await rm(workspace,{recursive:true,force:true});}
});
