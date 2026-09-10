import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {protocolTypes} from '../../dist/application/office.js';

await test('Unit removal is draft-only, reversible, reviewed and recovered after restart',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-unit-removal-'));let app=await startServer({workspace,port:0});
 try{
  const file=await app.office.open('removal.univer',true),fileId=file.catalog.fileId;
  const seed=await app.office.createWorktree(fileId),units=[];
  for(const kind of ['sheet','doc','slide','base','board'])units.push(await app.office.createUnit(fileId,seed.worktreeID,kind,`Keep ${kind}`));
  const merge=async id=>{await app.office.action(fileId,id,'ready','agent');const review=await app.office.reviewState(fileId,id);return app.office.action(fileId,id,'merge','viewer',review.fingerprint);};
  await merge(seed.worktreeID);
  const load=u=>app.office.file(fileId).service.getUnitLoadData({unitID:u.unitId,type:protocolTypes[u.kind],revision:0},{userID:'application'});
  const baseline=await Promise.all(units.map(load));
  const draft=await app.office.createWorktree(fileId,units.map(u=>u.unitId));
  const draftPreview=new URL(await app.createPreview({fileId,unitId:units[0].unitId,branch:'worktree',worktreeId:draft.worktreeID}));
  const request=async(u,removed)=>{
   const res=await fetch(`${app.origin}/api/files/${fileId}/units/${u.unitId}/removal`,{method:'POST',headers:{Authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify({worktreeId:draft.worktreeID,removed})});return {status:res.status,body:await res.json()};
  };
  assert.equal((await request(units[0],true)).status,200);
  assert.equal((await request(units[0],true)).status,200);
  assert.equal(Boolean((await request(units[0],false)).body.worktree.units.find(u=>u.unitID===units[0].unitId).removed),false);
  for(const u of units)assert.equal((await request(u,true)).status,200);
  assert.deepEqual(await Promise.all(units.map(load)),baseline);
  const previewState=await (await fetch(`${draftPreview.origin}${draftPreview.pathname}api/preview/resolve`)).json();assert.equal(previewState.removed,true);assert.equal(previewState.available,false);
  assert.ok((await app.office.status(fileId)).units.every(u=>!u.removed));
  await assert.rejects(app.office.resolveTarget({fileId,unitId:units[0].unitId,branch:'worktree',worktreeId:draft.worktreeID},'write'),e=>e.code==='UNIT_NOT_IN_WORKTREE');
  const preview=new URL(await app.createPreview({fileId,unitId:units[0].unitId,branch:'trunk'}));
  assert.equal((await fetch(`${preview.origin}${preview.pathname}api/files/${fileId}/units/${units[0].unitId}/removal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({worktreeId:draft.worktreeID,removed:false})})).status,403);
  await app.office.action(fileId,draft.worktreeID,'ready','agent');
  assert.equal((await request(units[0],false)).body.code,'WORKTREE_FROZEN');
  assert.equal((await app.office.action(fileId,draft.worktreeID,'merge','agent')).outcome,'pending-review');
  const review=await app.office.reviewState(fileId,draft.worktreeID);
  await app.office.action(fileId,draft.worktreeID,'discard','viewer',review.fingerprint);
  assert.deepEqual(await Promise.all(units.map(load)),baseline);
  assert.ok((await app.office.status(fileId)).units.every(u=>!u.removed));
  const removal=await app.office.createWorktree(fileId,units.map(u=>u.unitId));
  for(const u of units)await app.office.setUnitRemoved(fileId,removal.worktreeID,u.unitId,true);
  const result=await merge(removal.worktreeID);assert.equal(result.outcome,'completed');
  assert.ok(result.worktree.units.every(u=>u.mergeResult.status==='removed'));
  assert.deepEqual(await Promise.all(units.map(load)),baseline,'SDK keeps original trunk content');
  assert.ok((await app.office.status(fileId)).units.every(u=>u.removed));
  // Simulate directory projection loss after confirmed SDK removal.
  for(const u of units)file.catalog.put('unit',u.unitId,{...file.catalog.get('unit',u.unitId),removed:false});
  await app.close();app=await startServer({workspace,port:0});
  for(const u of units)await assert.rejects(app.office.resolveTarget({fileId,unitId:u.unitId,branch:'trunk'}),e=>e.code==='UNIT_NOT_FOUND');
  assert.ok((await app.office.status(fileId)).units.every(u=>u.removed));
  assert.deepEqual(await Promise.all(units.map(load)),baseline);
  await assert.rejects(app.office.resolveTarget({fileId,unitId:units[0].unitId,branch:'trunk'}),e=>e.code==='UNIT_NOT_FOUND');
  const retained=await app.office.removedUnits(fileId);assert.equal(retained.length,5);
  await assert.rejects(app.office.restoreRemovedUnit(fileId,units[0].unitId,retained[0].fingerprint,'agent'),e=>e.code==='VIEWER_REQUIRED');
  const first=retained.find(u=>u.unitId===units[0].unitId);
  await assert.rejects(app.office.restoreRemovedUnit(fileId,first.unitId,'0'.repeat(64),'viewer'),e=>e.code==='STALE_REVIEW');
  const catalog=app.office.file(fileId).catalog,put=catalog.put;
  catalog.put=function(kind,id,value){if(kind==='unit')throw new Error('simulated directory write failure');return put.call(this,kind,id,value);};
  try{await assert.rejects(app.office.restoreRemovedUnit(fileId,first.unitId,first.fingerprint,'viewer'),/simulated directory write failure/);}finally{catalog.put=put;}
  assert.equal(catalog.get('directory-restore',first.unitId),undefined);assert.equal(catalog.get('unit',first.unitId).removed,true);
  for(const u of retained){
   assert.equal((await app.office.restoreRemovedUnit(fileId,u.unitId,u.fingerprint,'viewer')).outcome,'restored');
   assert.equal((await app.office.restoreRemovedUnit(fileId,u.unitId,u.fingerprint,'viewer')).outcome,'restored');
  }
  await app.close();app=await startServer({workspace,port:0});
  for(const u of units)await app.office.resolveTarget({fileId,unitId:u.unitId,branch:'trunk'});
  assert.deepEqual(await Promise.all(units.map(load)),baseline);
  const again=await app.office.createWorktree(fileId,[first.unitId]);await app.office.setUnitRemoved(fileId,again.worktreeID,first.unitId,true);await merge(again.worktreeID);
  await assert.rejects(app.office.restoreRemovedUnit(fileId,first.unitId,first.fingerprint,'viewer'),e=>e.code==='STALE_REVIEW');
  const fresh=(await app.office.removedUnits(fileId)).find(u=>u.unitId===first.unitId);assert.notEqual(fresh.fingerprint,first.fingerprint);
  await app.office.restoreRemovedUnit(fileId,first.unitId,fresh.fingerprint,'viewer');
  const temporary=await app.office.createWorktree(fileId),unit=await app.office.createUnit(fileId,temporary.worktreeID,'sheet','Never publish');
  await app.office.setUnitRemoved(fileId,temporary.worktreeID,unit.unitId,true);await merge(temporary.worktreeID);
  assert.equal(app.office.file(fileId).catalog.get('unit',unit.unitId).removed,true);
  await assert.rejects(load(unit));
 }finally{await app.close();}
});
