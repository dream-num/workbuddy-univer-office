import {copyFile,mkdir,readFile,writeFile,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {runContent} from '../dist/application/content-worker.js';
const phase=process.argv[2];assert.ok(['create','serve','verify-cancel','verify','baseline-persistent-cancel','verify-persistent-cancel'].includes(phase));
const workspace=resolve('.data/sheet-restore-ui-workspace'),evidencePath='.data/sheet-restore-ui-evidence.json';let evidence;
if(phase==='create'){
 const source=JSON.parse(await readFile('.data/history-multiversion-evidence.json','utf8'));evidence={fileId:source.fileId,unitId:source.unitId};await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
 await mkdir(workspace,{recursive:true});await copyFile('.data/history-multiversion-workspace/history-versions.univer',resolve(workspace,'sheet-restore-ui.univer'),constants.COPYFILE_EXCL);
}else evidence=JSON.parse(await readFile(evidencePath,'utf8'));
const app=await startServer({workspace,port:9082});const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
try{
 const target={fileId:evidence.fileId,unitId:evidence.unitId,branch:'trunk'};
 const snapshot=await runContent({origin:app.origin,credential:app.agentToken,target,kind:'sheet',action:'snapshot',mode:'read'});
 const read=await runContent({origin:app.origin,credential:app.agentToken,target,kind:'sheet',action:'execute',mode:'read',code:"return {values:workbook.getActiveSheet().getRange('B2:B3').getValues(),formulas:workbook.getActiveSheet().getRange('B3').getFormulas()};"});
 const operations=app.office.file(evidence.fileId).catalog.list('history-restore');
 if(phase==='baseline-persistent-cancel'){
  evidence.persistentCancelBaseline={snapshot,read,operationIds:operations.map(o=>o.operationId)};await save();
 }
 if(phase==='verify-persistent-cancel'){
  const baseline=evidence.persistentCancelBaseline;assert.ok(baseline);assert.deepEqual(snapshot,baseline.snapshot);assert.deepEqual(read,baseline.read);
  const added=operations.filter(o=>!baseline.operationIds.includes(o.operationId));assert.equal(added.length,1);assert.equal(added[0].status,'cancelled');
  const {confirmHistoryRestore}=await import('../dist/application/history-restore.js');
  await assert.rejects(app.office.serial(()=>confirmHistoryRestore(app.office,evidence.fileId,added[0].operationId,'viewer')),error=>error.code==='RESTORE_CANCELLED');
  evidence.persistentCancelVerified={at:new Date().toISOString(),operationId:added[0].operationId,revision:snapshot.revision};await save();
  console.log('Persistent UI cancel verified after restart: full snapshot/formula/value/revision unchanged; one cancelled intent; confirmation rejected.');await app.close();process.exit(0);
 }
 if(phase==='create'){assert.deepEqual(read.value.values,[[42],[126]]);assert.equal(snapshot.revision,2);evidence.before=snapshot;evidence.readBefore=read;await save();}
 if(phase==='verify-cancel'){assert.deepEqual(snapshot,evidence.before);assert.deepEqual(read,evidence.readBefore);assert.equal(operations.length,1);assert.equal(operations[0].status,'prepared');evidence.cancelVerifiedAt=new Date().toISOString();evidence.cancelOperations=operations;await save();console.log('Cancel verified: complete Sheet snapshot, values, formula and revision unchanged.');}
 if(phase==='verify'){
  assert.deepEqual(read.value.values,[[7],[21]]);assert.deepEqual(read.value.formulas,evidence.readBefore.value.formulas);assert.equal(snapshot.revision,3);assert.equal(operations.length,2);assert.equal(operations.filter(o=>o.status==='completed').length,1);assert.equal(operations.find(o=>o.status==='completed').targetRevision,1);
  evidence.after=snapshot;evidence.readAfter=read;evidence.operations=operations;await save();console.log('Sheet UI restore persisted: revision 3, values 7/21, formula unchanged, one completed restore.');await app.close();process.exit(0);
 }
 const url=new URL(app.launchUrl);url.searchParams.set('file',target.fileId);url.searchParams.set('unit',target.unitId);await writeFile('.data/sheet-restore-ui-runtime.json',JSON.stringify({launchUrl:url.href}),{mode:0o600});console.log(JSON.stringify({pid:process.pid}));
}catch(e){await app.close();throw e;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
