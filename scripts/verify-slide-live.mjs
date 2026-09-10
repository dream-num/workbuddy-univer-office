import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const phase=process.argv[2];
assert.ok(['create','update','lint','ready'].includes(phase),'Usage: node scripts/verify-slide-live.mjs create|update|lint|ready');
const evidencePath='.data/slide-live-verification.json';
const config=JSON.parse(await readFile('.data/http-mcp-runtime.json','utf8'));
const client=new Client({name:'slide-live-verifier',version:'1'});
const call=async(name,args)=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:180000});if(r.isError)throw Error(JSON.stringify(r.content));return r.structuredContent.result;};
let evidence;
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
const svg=(title,label,body,footer)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#f3f7f5"/><rect width="1280" height="240" fill="#367d67"/><text x="70" y="110" fill="#ffffff" font-size="44" font-family="Arial">${title}</text><text x="72" y="175" fill="#def1e6" font-size="24" font-family="Arial">Office SDK · 原生 Slide · 实时预览</text><text x="70" y="360" fill="#245442" font-size="36" font-family="Arial">${label}</text><text x="70" y="430" fill="#53685e" font-size="26" font-family="Arial">${body}</text><text x="70" y="655" fill="#697d72" font-size="20" font-family="Arial">${footer}</text></svg>`;
const read=()=>call('univer_execute',{target:evidence.target,mode:'read',code:'return {pageCount:presentation.getSlides().length,snapshot:JSON.parse(JSON.stringify(presentation.save()))};'});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:config.headers}}));
 if(phase==='create'){
  evidence={filename:`slide-live-${Date.now()}.univer`};await writeFile(evidencePath,JSON.stringify(evidence),{flag:'wx'});
  const file=await call('univer_new',{file:evidence.filename});evidence.fileId=file.fileId;await save();
  const draft=await call('univer_worktree',{fileId:file.fileId,action:'create'});evidence.worktreeId=draft.worktreeID;await save();
  const unit=await call('univer_unit',{fileId:file.fileId,worktreeId:draft.worktreeID,action:'create',kind:'slide',name:'演示文稿实时同步验证'});
  evidence.target={fileId:file.fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,branch:'worktree'};await save();
  evidence.initial=await call('univer_compile_svg',{target:evidence.target,page:1,mode:'replace',source:svg('WorkBuddy 演示文稿验证','初始页面','下一步：更新本页，并追加第二页。','验证草稿 · 第 1 页')});await save();assert.equal(evidence.initial.commit,'confirmed');
  evidence.readBefore=await read();await save();assert.equal(evidence.readBefore.value.pageCount,1);
 }else{
  evidence=JSON.parse(await readFile(evidencePath,'utf8'));
  if(phase==='update'){
   assert.ok(!evidence.updateAttemptedAt,'Update already attempted; inspect before retrying.');evidence.updateAttemptedAt=new Date().toISOString();await save();
   evidence.updatedPage=await call('univer_compile_svg',{target:evidence.target,page:1,mode:'replace',source:svg('WorkBuddy 演示文稿验证','实时同步已更新','本页内容由 Agent 更新，无需手动刷新预览。','验证草稿 · 第 1 / 2 页')});await save();assert.equal(evidence.updatedPage.commit,'confirmed');
   evidence.addedPage=await call('univer_compile_svg',{target:evidence.target,page:2,mode:'append',source:svg('第二页 · 审阅流程','新增页面已同步','创建草稿 → 自动验证 → 人工审阅','验证草稿 · 第 2 / 2 页')});await save();assert.equal(evidence.addedPage.commit,'confirmed');
   evidence.readAfter=await read();await save();assert.equal(evidence.readAfter.value.pageCount,2);assert.equal(evidence.readAfter.mutations,0);
   assert.ok(JSON.stringify(evidence.readAfter.value.snapshot).includes('实时同步已更新'));assert.ok(JSON.stringify(evidence.readAfter.value.snapshot).includes('新增页面已同步'));
  }else if(phase==='lint'){
   evidence.lint=await call('univer_lint',{target:evidence.target});await save();
  }else{
   assert.equal(evidence.lint?.coverage.pages.length,evidence.readAfter?.value.pageCount,'Lint every page before review.');
   assert.deepEqual(evidence.lint?.findings,[],'Resolve fixture layout findings before review.');
   evidence.ready=await call('univer_worktree',{fileId:evidence.target.fileId,worktreeId:evidence.target.worktreeId,action:'ready'});await save();assert.equal(evidence.ready.worktree.status,'ready');
  }
 }
 const result=phase==='create'?evidence.initial:phase==='update'?{updated:evidence.updatedPage,added:evidence.addedPage}:evidence[phase];
 console.log(JSON.stringify({phase,target:evidence.target,result}));
}finally{await client.close();}
