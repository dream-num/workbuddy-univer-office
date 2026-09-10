import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rename,writeFile,unlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startServer} from '../../dist/server/main.js';
import {protocolTypes,emptyUnit} from '../../dist/application/office.js';
test('moved or replaced file denies HTTP and retained SDK handles; restoring original resumes unchanged',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-unavailable-'));const app=await startServer({workspace,port:0});
 const path=join(workspace,'original.univer'),moved=join(workspace,'original.retained');let displaced=false;
 try{
  const file=await app.office.open('original.univer',true),id=file.catalog.fileId;
  const draft=await app.office.createWorktree(id),unit=await app.office.createUnit(id,draft.worktreeID,'sheet','Retained content');
  const input={worktreeID:draft.worktreeID,unitID:unit.unitId,type:protocolTypes.sheet,revision:0},ctx={userID:'application'};
  const before=await file.worktrees.getUnitLoadData(input,ctx);
  await rename(path,moved);displaced=true;
  const denied=await fetch(`${app.origin}/api/files/${id}`,{headers:{Authorization:`Bearer ${app.agentToken}`}});
  assert.equal(denied.status,404);assert.equal((await denied.json()).code,'FILE_UNAVAILABLE');
  await assert.rejects(file.worktrees.getUnitLoadData(input,ctx),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(file.worktrees.createUnitFromData({...emptyUnit('sheet','unexpected-unit','Must not create'),worktreeID:draft.worktreeID},ctx),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(app.office.action(id,draft.worktreeID,'ready','agent'),e=>e.code==='FILE_UNAVAILABLE');
  await writeFile(path,'different physical file',{flag:'wx'});
  await assert.rejects(app.office.status(id),e=>e.code==='FILE_UNAVAILABLE');
  await unlink(path);await rename(moved,path);displaced=false;
  assert.deepEqual(await file.worktrees.getUnitLoadData(input,ctx),before);
  const status=await app.office.status(id);assert.equal(status.units.length,1);assert.equal(status.worktrees[0].status,'draft');
 }finally{
  if(displaced){await unlink(path).catch(()=>{});await rename(moved,path);}
  await app.close();await rm(workspace,{recursive:true,force:true});
 }
});
