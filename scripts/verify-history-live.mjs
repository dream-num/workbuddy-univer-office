import {copyFile,mkdir,readFile,writeFile,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {runContent} from '../dist/application/content-worker.js';
const phase=process.argv[2];assert.ok(['create','serve','verify'].includes(phase),'Usage: create|serve|verify');
const workspace=resolve('.data/history-multiversion-workspace');
const evidencePath='.data/history-multiversion-evidence.json';
let evidence;
if(phase==='create'){
 evidence={createdAt:new Date().toISOString(),fileId:'6e45fde2-4e0c-41a1-aad9-4ebd7a9e8016',unitId:'e11bdb00-9b59-4452-b7ec-89d1da290f38'};
 await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
 await mkdir(workspace,{recursive:true});
 // The closed seed database has no WAL sidecar. Never copy a live database.
 await copyFile('.data/terminal-live-workspace/terminal-1788981416101.univer',resolve(workspace,'history-versions.univer'),constants.COPYFILE_EXCL);
}else evidence=JSON.parse(await readFile(evidencePath,'utf8'));
const app=await startServer({workspace,port:9082});
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
const run=(target,mode,code)=>runContent({origin:app.origin,credential:app.agentToken,target,kind:'sheet',action:'execute',mode,code});
const target={fileId:evidence.fileId,unitId:evidence.unitId,branch:'trunk'};
try{
 if(phase==='create'){
  evidence.before=await run(target,'read',"return workbook.getActiveSheet().getRange('B2:B3').getValues();");assert.deepEqual(evidence.before.value,[[7],[21]]);await save();
  const draft=await app.office.createWorktree(target.fileId,[target.unitId]);
  evidence.draftTarget={...target,branch:'worktree',worktreeId:draft.worktreeID};await save();
  evidence.writeAttemptedAt=new Date().toISOString();await save();
  evidence.write=await run(evidence.draftTarget,'write',"workbook.getActiveSheet().getRange('B2').setValue(42);return true;");assert.equal(evidence.write.commit,'confirmed');await save();
  await app.office.action(target.fileId,draft.worktreeID,'ready','agent');
  const review=await app.office.reviewState(target.fileId,draft.worktreeID);
  evidence.merge=await app.office.action(target.fileId,draft.worktreeID,'merge','viewer',review.fingerprint);assert.equal(evidence.merge.worktree.status,'merged');await save();
  evidence.after=await run(target,'read',"return workbook.getActiveSheet().getRange('B2:B3').getValues();");assert.deepEqual(evidence.after.value,[[42],[126]]);await save();
 }
 evidence.history=await app.office.file(target.fileId).history.getHistoryList({unitID:target.unitId,length:100},{userID:'viewer'});await save();
 assert.ok(evidence.history.historyIds.length>=2,'Need at least two actual history entries');
 if(phase==='verify'){
  evidence.readAfterViewing=await run(target,'read',"return workbook.getActiveSheet().getRange('B2:B3').getValues();");
  assert.deepEqual(evidence.readAfterViewing.value,[[42],[126]]);assert.equal(evidence.readAfterViewing.mutations,0);await save();
  console.log('After viewing and restart: trunk remains 42/126, read mutations=0, two history entries retained.');
  await app.close();process.exit(0);
 }
 const url=new URL(app.launchUrl);url.searchParams.set('file',target.fileId);url.searchParams.set('unit',target.unitId);
 await writeFile('.data/history-multiversion-runtime.json',JSON.stringify({launchUrl:url.href,origin:app.origin}),{mode:0o600});
 console.log(JSON.stringify({historyEntries:evidence.history.historyIds.length,before:evidence.before.value,after:evidence.after.value,pid:process.pid}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
