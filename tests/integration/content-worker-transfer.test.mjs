import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';
import {runContent} from '../../dist/application/content-worker.js';

test('content worker delivers buffered large read results before disconnecting',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-worker-transfer-')),app=await startServer({workspace,port:0});
 try{
  const file=await app.office.open('transfer.univer',true),fileId=file.catalog.fileId;
  const draft=await app.office.createWorktree(fileId,[]),unit=await app.office.createUnit(fileId,draft.worktreeID,'sheet','Transfer');
  const result=await runContent({origin:app.origin,credential:app.agentToken,target:{fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,branch:'worktree'},kind:'sheet',action:'execute',mode:'read',code:"return {payload:'x'.repeat(2*1024*1024),end:'complete'};"});
  assert.equal(result.value.payload.length,2*1024*1024);assert.equal(result.value.end,'complete');assert.equal(result.mutations,0);
 }finally{await app.close();await rm(workspace,{recursive:true,force:true});}
});
