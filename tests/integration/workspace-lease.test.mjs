import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {startServer} from '../../dist/server/main.js';
import {startHttpMcpServer} from '../../dist/mcp/http.js';

test('one workspace owner across transports, aliases and graceful restart',async()=>{
  const root=await mkdtemp(join(tmpdir(),'office-lease-'));
  let owner,next;
  try {
    const workspace=join(root,'workspace');
    owner=await startServer({workspace,port:0});
    await symlink(workspace,join(root,'alias'),'junction');
    await assert.rejects(startHttpMcpServer({workspace:join(root,'alias'),port:0}),e=>e.code==='WORKSPACE_IN_USE');
    assert.equal((await fetch(owner.origin+'/health')).status,200);
    const file=await owner.office.open('retained.univer',true);
    const fileId=file.catalog.fileId;
    await Promise.all([owner.close(),owner.close()]);owner=undefined;
    next=await startHttpMcpServer({workspace,port:0});
    assert.equal(next.office.list()[0].fileId,fileId);
  } finally {await next?.close();await owner?.close();await rm(root,{recursive:true,force:true});}
});

test('failed listener startup releases workspace ownership',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-lease-failed-'));
  let runtime;
  try {
    await assert.rejects(startServer({workspace,port:-1}),/port/i);
    runtime=await startServer({workspace,port:0});
    assert.equal((await fetch(runtime.origin+'/health')).status,200);
  } finally {await runtime?.close();await rm(workspace,{recursive:true,force:true});}
});

test('a separate process cannot take ownership until the owner exits, including SIGKILL',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-lease-process-'));
  let runtime;
  const child=fork(new URL('../fixtures/workspace-owner.mjs',import.meta.url),[workspace],{stdio:['ignore','ignore','pipe','ipc']});
  const exited=once(child,'exit');
  try {
    const [ready]=await once(child,'message',{signal:AbortSignal.timeout(15000)});
    await assert.rejects(startHttpMcpServer({workspace,port:0}),e=>e.code==='WORKSPACE_IN_USE');
    assert.equal((await fetch(ready.origin+'/health')).status,200);
    child.kill('SIGKILL');await exited;
    runtime=await startServer({workspace,port:0});
    assert.equal((await fetch(runtime.origin+'/health')).status,200);
  } finally {
    if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
    await runtime?.close();await rm(workspace,{recursive:true,force:true});
  }
});
