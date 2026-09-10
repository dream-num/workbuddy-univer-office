import {startServer} from '../dist/server/main.js';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const workspace=await mkdtemp(resolve('.data/doc-header-probe-'));
const app=await startServer({workspace,port:0});
const results=[];
try{
 const call=async(path,body)=>{const r=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(JSON.stringify(x));return x};
 const {fileId}=await call('/files',{file:'probe.univer'}),{worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
 for(const mode of ['same','split']){
  const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'doc',name:mode}),target={fileId,unitId,worktreeId,branch:'worktree'};
  const execute=code=>call('/content',{target,action:'execute',mode:'write',code});
  if(mode==='split')await execute(`doc.ensurePageHeader();doc.ensurePageFooter();return true;`);
  const local=await execute(`const header=doc.ensurePageHeader(),footer=doc.ensurePageFooter();doc.insertText(0,'HEADER',header);doc.insertText(0,'FOOTER',footer);return {header:doc.getBody(header).dataStream,footer:doc.getBody(footer).dataStream};`);
  const snapshot=await call('/content',{target,action:'snapshot'});
  results.push({mode,local,reloaded:{headers:snapshot.unitData.headers,footers:snapshot.unitData.footers}});
 }
 await writeFile('.data/doc-header-probe.json',JSON.stringify({workspace,results},null,2));console.log(JSON.stringify(results.map(({mode,local,reloaded})=>({mode,local:local.value,reloaded:{headers:Object.values(reloaded.headers).map(x=>x.body.dataStream),footers:Object.values(reloaded.footers).map(x=>x.body.dataStream)}})),null,2));
 for(const result of results){
  assert.deepEqual(Object.values(result.reloaded.headers).map(x=>x.body.dataStream),[result.local.value.header],`${result.mode}: persisted header differs from executed content`);
  assert.deepEqual(Object.values(result.reloaded.footers).map(x=>x.body.dataStream),[result.local.value.footer],`${result.mode}: persisted footer differs from executed content`);
 }
}finally{await app.close()}
