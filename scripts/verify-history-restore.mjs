import {copyFile,mkdir,readFile,writeFile,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {protocolTypes} from '../dist/application/office.js';
import {runContent} from '../dist/application/content-worker.js';
const phase=process.argv[2];assert.ok(['create','verify','serve'].includes(phase));
const workspace=resolve('.data/history-restore-workspace'), evidencePath='.data/history-restore-evidence.json';
let evidence;
if(phase==='create'){
 const source=JSON.parse(await readFile('.data/history-products-evidence.json','utf8'));
 evidence={fileId:source.fileId,units:Object.fromEntries(Object.entries(source.units).map(([kind,u])=>[kind,{unitId:u.unitId}])),createdAt:new Date().toISOString()};
 await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
 await mkdir(workspace,{recursive:true});
 // The source verification server is closed; its workspace has no journal/WAL sidecar.
 await copyFile('.data/history-products-workspace/history-products.univer',resolve(workspace,'history-restore.univer'),constants.COPYFILE_EXCL);
}else evidence=JSON.parse(await readFile(evidencePath,'utf8'));
const app=await startServer({workspace,port:9082});
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
const snapshot=(kind,unitId)=>runContent({origin:app.origin,credential:app.agentToken,target:{fileId:evidence.fileId,unitId,branch:'trunk'},kind,action:'snapshot',mode:'read'});
try{
 for(const [kind,record] of Object.entries(evidence.units)){
  const file=app.office.file(evidence.fileId);
  if(phase==='create'){
   record.before=await snapshot(kind,record.unitId);await save();assert.equal(record.before.revision,2);assert.ok(JSON.stringify(record.before.unitData).includes('第二个版本'));
   record.request={unitID:record.unitId,type:protocolTypes[kind],baseRev:record.before.revision,revision:0,userID:'application',memberID:'restore-verifier',sid:randomUUID(),reqId:1,mutations:[{id:'univer.mutation.revert-version',data:JSON.stringify({unitId:record.unitId,revision:1})}]};await save();
   record.result=await file.service.submitChangeset({changeset:record.request},{userID:'application',memberID:'restore-verifier'});await save();assert.equal(record.result.status,'committed');assert.equal(record.result.changeset.revision,3);
   record.after=await snapshot(kind,record.unitId);await save();assert.equal(record.after.revision,3);assert.ok(!JSON.stringify(record.after.unitData).includes('第二个版本'));assert.ok(JSON.stringify(record.after.unitData).includes('历史'));
   record.retry=await file.service.submitChangeset({changeset:record.request},{userID:'application',memberID:'restore-verifier'});await save();assert.equal(record.retry.status,'already-committed');assert.deepEqual(await snapshot(kind,record.unitId),record.after);
  }else if(phase==='verify') assert.deepEqual(await snapshot(kind,record.unitId),record.after);
  record.history=await file.history.getHistoryList({unitID:record.unitId,length:100},{userID:'viewer'});await save();assert.ok(record.history.historyIds.length>=3);
 }
 if(phase==='verify'){console.log('Four restored snapshots survive restart; all retain revision 3 and at least three history entries.');await app.close();process.exit(0);}
 const launch=new URL(app.launchUrl);launch.searchParams.set('file',evidence.fileId);launch.searchParams.set('unit',evidence.units.doc.unitId);
 await writeFile('.data/history-restore-runtime.json',JSON.stringify({launchUrl:launch.href,origin:app.origin}),{mode:0o600});console.log(JSON.stringify({pid:process.pid,kinds:Object.keys(evidence.units)}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
