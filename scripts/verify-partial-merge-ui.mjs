import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {protocolTypes} from '../dist/application/office.js';
import {partialMergeFixture} from '../tests/fixtures/partial-merge.mjs';
const phase=process.argv[2];assert.ok(['create','serve','verify'].includes(phase));
const app=await startServer({workspace:resolve('.data/partial-merge-ui-workspace'),port:9082});
try{
 if(phase==='create'||phase==='serve'){
  const {rejection,...f}=phase==='create'?await partialMergeFixture(app):JSON.parse(await readFile('.data/partial-merge-ui-evidence.json','utf8'));
  if(phase==='create')await writeFile('.data/partial-merge-ui-evidence.json',JSON.stringify(f),{flag:'wx'});
  const url=new URL(app.launchUrl);for(const [key,value]of Object.entries({file:f.fileId,unit:f.units[0].unitId,worktree:f.worktreeId}))url.searchParams.set(key,value);
  await writeFile('.data/partial-merge-ui-runtime.json',JSON.stringify({launchUrl:url.href}),{mode:0o600});console.log(JSON.stringify({pid:process.pid}));
 }else{
  const f=JSON.parse(await readFile('.data/partial-merge-ui-evidence.json','utf8'));
  const status=await app.office.status(f.fileId),worktree=status.worktrees.find(w=>w.worktreeID===f.worktreeId);
  assert.equal(worktree.status,'merged');assert.deepEqual(worktree.units.map(u=>u.mergeResult.status),['merged','merged']);
  for(const unit of f.units){const data=await app.office.file(f.fileId).service.getUnitLoadData({unitID:unit.unitId,type:protocolTypes.sheet,revision:0},{userID:'application'});assert.equal(data.targetRevision,1);}
  const operations=app.office.file(f.fileId).catalog.list('operation').filter(o=>o.action==='merge');
  assert.deepEqual(operations.map(o=>o.outcome),['partial','completed']);
  console.log('Partial merge UI persisted after restart: both Units revision 1; partial then completed operation results.');await app.close();process.exit(0);
 }
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
