import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {protocolTypes,emptyUnit} from '../../dist/application/office.js';
import {partialMergeFixture} from '../fixtures/partial-merge.mjs';
test('partial merge survives restart and retries only the failed Unit',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-partial-'));let app=await startServer({workspace,port:0});
 try{
  const f=await partialMergeFixture(app);
  const review=await app.office.reviewState(f.fileId,f.worktreeId);
  const first=await app.office.action(f.fileId,f.worktreeId,'merge','viewer',review.fingerprint);
  assert.equal(first.outcome,'partial');assert.deepEqual(first.worktree.units.map(u=>u.mergeResult.status),['merged','failed']);
  const load=id=>app.office.file(f.fileId).service.getUnitLoadData({unitID:id,type:protocolTypes.sheet,revision:0},{userID:'application'});
  const baseline=await load(f.units[0].unitId);assert.equal(baseline.targetRevision,1);
  await assert.rejects(load(f.units[1].unitId));
  await app.close();app=await startServer({workspace,port:0});
  assert.deepEqual((await app.office.reviewState(f.fileId,f.worktreeId)).worktree.units.map(u=>u.mergeResult.status),['merged','failed']);
  await assert.rejects(app.office.action(f.fileId,f.worktreeId,'merge','viewer',review.fingerprint),e=>e.code==='STALE_REVIEW');
  const current=await app.office.reviewState(f.fileId,f.worktreeId);
  const second=await app.office.action(f.fileId,f.worktreeId,'merge','viewer',current.fingerprint);
  assert.equal(second.outcome,'completed');assert.equal(second.worktree.status,'merged');
  assert.deepEqual(await load(f.units[0].unitId),baseline);
  assert.equal((await load(f.units[1].unitId)).targetRevision,1);
  assert.ok((await app.office.status(f.fileId)).units.every(u=>!u.worktreeId));
  const launch=new URL(app.launchUrl);
  launch.searchParams.set('file',f.fileId);launch.searchParams.set('unit',f.units[0].unitId);launch.searchParams.set('review',f.worktreeId);
  const opened=await fetch(launch,{redirect:'manual'});
  assert.equal(opened.status,303);
  assert.equal(new URL(opened.headers.get('location'),app.origin).searchParams.get('review'),f.worktreeId);
  launch.searchParams.set('review','unavailable-review');
  assert.equal((await fetch(launch,{redirect:'manual'})).status,400);
  assert.deepEqual(await load(f.units[0].unitId),baseline);
 }finally{await app.close();await rm(workspace,{recursive:true,force:true});}
});

test('a conflicting Unit does not roll back its sibling or overwrite trunk on retry',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-partial-conflict-'));const app=await startServer({workspace,port:0});
 try{
  const f=await partialMergeFixture(app);f.rejection.dispose();
  const file=app.office.file(f.fileId),conflicting=f.units[1].unitId;
  await file.service.createUnitFromData(emptyUnit('sheet',conflicting,'主线已有不同内容'),{userID:'application'});
  const load=id=>file.service.getUnitLoadData({unitID:id,type:protocolTypes.sheet,revision:0},{userID:'application'});
  const original=await load(conflicting);let sibling;
  for(let attempt=0;attempt<2;attempt++){
   const review=await app.office.reviewState(f.fileId,f.worktreeId);
   const result=await app.office.action(f.fileId,f.worktreeId,'merge','viewer',review.fingerprint);
   assert.equal(result.outcome,'partial');assert.deepEqual(result.worktree.units.map(u=>u.mergeResult.status),['merged','conflict']);
   assert.equal(result.worktree.units[1].mergeResult.error.code,'WORKTREE_CREATE_CONFLICT');
   assert.deepEqual(await load(conflicting),original);
   const current=await load(f.units[0].unitId);assert.equal(current.targetRevision,1);
   if(sibling)assert.deepEqual(current,sibling);else sibling=current;
  }
 }finally{await app.close();await rm(workspace,{recursive:true,force:true});}
});
