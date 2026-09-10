import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {runContent} from '../dist/application/content-worker.js';
import {compileSvgToFacade,wrapSlideScript} from '@univer-cli/svg-facade';
const phase=process.argv[2];assert.ok(['create','update','serve','baseline','verify'].includes(phase),'Usage: create|update|serve|baseline|verify');
const path='.data/history-products-evidence.json';let evidence;
if(phase==='create'){evidence={units:{},createdAt:new Date().toISOString()};await writeFile(path,JSON.stringify(evidence),{flag:'wx'});}
else evidence=JSON.parse(await readFile(path,'utf8'));
const app=await startServer({workspace:resolve('.data/history-products-workspace'),port:9082});
const save=()=>writeFile(path,JSON.stringify(evidence,null,2));
try{
 if(phase==='create'){
  const file=await app.office.open('history-products.univer',true);evidence.fileId=file.catalog.fileId;await save();
  const draft=await app.office.createWorktree(evidence.fileId);evidence.worktreeId=draft.worktreeID;await save();
  const svg=await compileSvgToFacade('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#e8f3ee"/><text x="80" y="150" font-size="48" fill="#245442">Slide 历史验证</text></svg>');
  const codes={doc:"doc.appendParagraph('Doc 历史验证').getTextRange().setTextStyle({fs:24,bl:1});doc.appendParagraph('这是需要在历史版本中保留的正文。');return true;",slide:wrapSlideScript(svg.code,{page:1,mode:'add',...svg.viewport}),base:"const t=base.insertTable('Base 历史验证',{primaryFieldName:'事项'});t.addRecords([{values:{[t.getPrimaryFieldId()]:'历史记录保留'}}]);return true;",board:"board.insertText({left:80,top:80,text:'Board 历史验证'});return true;"};
  for(const [kind,code] of Object.entries(codes)){
   const unit=await app.office.createUnit(evidence.fileId,draft.worktreeID,kind,`${kind} 历史验证`);evidence.units[kind]={unitId:unit.unitId};await save();
   const target={fileId:evidence.fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,branch:'worktree'};
   const result=await runContent({origin:app.origin,credential:app.agentToken,target,kind,action:'execute',mode:'write',code});evidence.units[kind].write=result;await save();assert.equal(result.commit,'confirmed');
  }
  await app.office.action(evidence.fileId,draft.worktreeID,'ready','agent');
  const review=await app.office.reviewState(evidence.fileId,draft.worktreeID);
  evidence.merge=await app.office.action(evidence.fileId,draft.worktreeID,'merge','viewer',review.fingerprint);await save();assert.equal(evidence.merge.worktree.status,'merged');
 }
 if(phase==='update'){
  assert.equal(evidence.update,undefined,'Update already attempted; inspect saved evidence before retrying');
  evidence.update={attemptedAt:new Date().toISOString(),writes:{}};await save();
  const draft=await app.office.createWorktree(evidence.fileId,Object.values(evidence.units).map(u=>u.unitId));
  evidence.update.worktreeId=draft.worktreeID;await save();
  const svg=await compileSvgToFacade('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#e8eef8"/><text x="80" y="150" font-size="48" fill="#244478">Slide 第二个版本</text></svg>');
  const codes={doc:"doc.appendParagraph('Doc 第二个版本新增正文');return true;",slide:wrapSlideScript(svg.code,{page:2,mode:'add',...svg.viewport}),base:"const t=base.getTables()[0];t.addRecords([{values:{[t.getPrimaryFieldId()]:'Base 第二个版本新增记录'}}]);return true;",board:"board.insertText({left:80,top:180,text:'Board 第二个版本新增元素'});return true;"};
  for(const [kind,code] of Object.entries(codes)){
   const target={fileId:evidence.fileId,unitId:evidence.units[kind].unitId,worktreeId:draft.worktreeID,branch:'worktree'};
   const result=await runContent({origin:app.origin,credential:app.agentToken,target,kind,action:'execute',mode:'write',code});evidence.update.writes[kind]=result;await save();assert.equal(result.commit,'confirmed');
  }
  await app.office.action(evidence.fileId,draft.worktreeID,'ready','agent');
  const review=await app.office.reviewState(evidence.fileId,draft.worktreeID);
  evidence.update.merge=await app.office.action(evidence.fileId,draft.worktreeID,'merge','viewer',review.fingerprint);await save();assert.equal(evidence.update.merge.worktree.status,'merged');
 }
 for(const record of Object.values(evidence.units)){
  record.history=await app.office.file(evidence.fileId).history.getHistoryList({unitID:record.unitId,length:100},{userID:'viewer'});assert.ok(record.history.historyIds.length>=(evidence.update?.merge?2:1));
 }
 if(phase==='baseline'||phase==='verify'){
  const snapshots={};
  for(const [kind,record] of Object.entries(evidence.units)){
   snapshots[kind]=await runContent({origin:app.origin,credential:app.agentToken,target:{fileId:evidence.fileId,unitId:record.unitId,branch:'trunk'},kind,action:'snapshot',mode:'read'});
  }
  const baselinePath='.data/history-products-view-baseline.json';
  if(phase==='baseline') await writeFile(baselinePath,JSON.stringify(snapshots,null,2),{flag:'wx'});
  else {assert.deepEqual(snapshots,JSON.parse(await readFile(baselinePath,'utf8')));console.log('Four complete trunk snapshots and revisions unchanged after history viewing.');}
  if(phase==='verify'){await save();await app.close();process.exit(0);}
 }
 await save();const launch=new URL(app.launchUrl);launch.searchParams.set('file',evidence.fileId);launch.searchParams.set('unit',evidence.units.doc.unitId);
 await writeFile('.data/history-products-runtime.json',JSON.stringify({launchUrl:launch.href,origin:app.origin}),{mode:0o600});
 console.log(JSON.stringify({pid:process.pid,kinds:Object.keys(evidence.units)}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
