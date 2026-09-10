import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {protocolTypes} from '../dist/application/office.js';
const phase=process.argv[2];assert.ok(['create','verify'].includes(phase));
const workspace=resolve('.data/unit-removal-ui-workspace'),evidencePath='.data/unit-removal-ui-evidence.json';
const app=await startServer({workspace,port:9082});
try{
 let evidence;
 if(phase==='create'){
  const file=await app.office.open('reviewed-removal.univer',true),fileId=file.catalog.fileId;
  const seed=await app.office.createWorktree(fileId),unit=await app.office.createUnit(fileId,seed.worktreeID,'sheet','待审阅的内容移除');
  await app.office.action(fileId,seed.worktreeID,'ready','agent');let review=await app.office.reviewState(fileId,seed.worktreeID);await app.office.action(fileId,seed.worktreeID,'merge','viewer',review.fingerprint);
  const baseline=await file.service.getUnitLoadData({unitID:unit.unitId,type:protocolTypes.sheet,revision:0},{userID:'application'});
  const draft=await app.office.createWorktree(fileId,[unit.unitId]);evidence={fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,baseline};
  await writeFile(evidencePath,JSON.stringify(evidence,null,2),{flag:'wx'});
  const url=new URL(app.launchUrl);for(const [key,value]of Object.entries({file:fileId,unit:unit.unitId,worktree:draft.worktreeID}))url.searchParams.set(key,value);
  await writeFile('.data/unit-removal-ui-runtime.json',JSON.stringify({launchUrl:url.href}),{mode:0o600});console.log(JSON.stringify({pid:process.pid}));
 }else{
  evidence=JSON.parse(await readFile(evidencePath,'utf8'));const file=app.office.file(evidence.fileId);
  const status=await app.office.status(evidence.fileId);assert.equal(status.units.find(u=>u.unitId===evidence.unitId).removed,true);
  const worktree=status.worktrees.find(w=>w.worktreeID===evidence.worktreeId);assert.equal(worktree.status,'merged');assert.equal(worktree.units[0].mergeResult.status,'removed');
  const retained=await file.service.getUnitLoadData({unitID:evidence.unitId,type:protocolTypes.sheet,revision:0},{userID:'application'});
  assert.deepEqual(JSON.parse(JSON.stringify(retained)),evidence.baseline);
  console.log('UI removal persisted after restart: merged, directory removed, original SDK content and revision preserved.');await app.close();process.exit(0);
 }
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
