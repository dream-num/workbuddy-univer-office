import {copyFile,mkdir,readFile,writeFile,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {runContent} from '../dist/application/content-worker.js';
const phase=process.argv[2];assert.ok(['create','serve','verify','verify-disconnect','verify-products'].includes(phase));
const workspace=resolve('.data/history-restore-ui-workspace'),evidencePath='.data/history-restore-ui-evidence.json';
let evidence;
if(phase==='create'){
 const source=JSON.parse(await readFile('.data/history-restore-evidence.json','utf8'));
 evidence={fileId:source.fileId,unitId:source.units.doc.unitId};await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
 await mkdir(workspace,{recursive:true});await copyFile('.data/history-restore-workspace/history-restore.univer',resolve(workspace,'history-restore-ui.univer'),constants.COPYFILE_EXCL);
}else evidence=JSON.parse(await readFile(evidencePath,'utf8'));
const app=await startServer({workspace,port:9082});
try{
 const snapshot=await runContent({origin:app.origin,credential:app.agentToken,target:{fileId:evidence.fileId,unitId:evidence.unitId,branch:'trunk'},kind:'doc',action:'snapshot',mode:'read'});
 if(phase==='verify-products'){
  const source=JSON.parse(await readFile('.data/history-restore-evidence.json','utf8'));const products={};
  for(const kind of ['slide','base','board']){
   const unitId=source.units[kind].unitId;
   products[kind]=await runContent({origin:app.origin,credential:app.agentToken,target:{fileId:evidence.fileId,unitId,branch:'trunk'},kind,action:'snapshot',mode:'read'});
   assert.equal(products[kind].revision,4);assert.ok(JSON.stringify(products[kind].unitData).includes('第二个版本'));
  }
  assert.deepEqual(snapshot,evidence.disconnectAfter);
  const operations=app.office.file(evidence.fileId).catalog.list('history-restore');assert.equal(operations.length,5);
  for(const kind of ['slide','base','board']){const selected=operations.filter(o=>o.unitId===source.units[kind].unitId);assert.equal(selected.length,1);assert.equal(selected[0].status,'completed');assert.equal(selected[0].targetRevision,2);}
  evidence.productsAfter=products;evidence.productOperations=operations;await writeFile(evidencePath,JSON.stringify(evidence,null,2));console.log('Slide/Base/Board UI restores survive restart at revision 4 with one completed operation each; Doc remains unchanged.');await app.close();process.exit(0);
 }
 if(phase==='create'){assert.equal(snapshot.revision,3);evidence.before=snapshot;await writeFile(evidencePath,JSON.stringify(evidence,null,2));}
 if(phase==='verify'||phase==='verify-disconnect'){
  if(phase==='verify-disconnect'){
   assert.equal(snapshot.revision,5);assert.ok(!JSON.stringify(snapshot.unitData).includes('Doc 第二个版本新增正文'));
   const operations=app.office.file(evidence.fileId).catalog.list('history-restore');assert.equal(operations.length,2);assert.equal(operations[1].status,'completed');assert.equal(operations[1].targetRevision,1);
   evidence.disconnectAfter=snapshot;evidence.disconnectOperations=operations;await writeFile(evidencePath,JSON.stringify(evidence,null,2));console.log('Disconnect-before-restore verified after restart: revision 5, original Doc content, exactly two completed operations in fixture.');await app.close();process.exit(0);
  }
  assert.equal(snapshot.revision,4);assert.ok(JSON.stringify(snapshot.unitData).includes('Doc 第二个版本新增正文'));
  const operations=app.office.file(evidence.fileId).catalog.list('history-restore');assert.equal(operations.length,1);assert.equal(operations[0].status,'completed');assert.equal(operations[0].targetRevision,2);
  evidence.after=snapshot;evidence.operations=operations;await writeFile(evidencePath,JSON.stringify(evidence,null,2));console.log('UI restore verified after restart: Doc revision 4, selected revision-2 content present, one completed application operation.');await app.close();process.exit(0);
 }
 const launch=new URL(app.launchUrl);launch.searchParams.set('file',evidence.fileId);launch.searchParams.set('unit',evidence.unitId);await writeFile('.data/history-restore-ui-runtime.json',JSON.stringify({launchUrl:launch.href}),{mode:0o600});console.log(JSON.stringify({pid:process.pid}));
}catch(e){await app.close();throw e;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
