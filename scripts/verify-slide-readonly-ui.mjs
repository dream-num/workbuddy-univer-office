import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const phase=process.argv[2];assert.ok(['before','after'].includes(phase));
const config=JSON.parse(await readFile('.data/http-mcp-runtime.json','utf8'));
const {target}=JSON.parse(await readFile('.data/slide-live-verification.json','utf8'));
const client=new Client({name:'slide-readonly-ui-verifier',version:'1'});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:config.headers}}));
 const call=async(name,args)=>{const r=await client.callTool({name,arguments:args});assert.ok(!r.isError);return r.structuredContent.result;};
 const result=await call('univer_execute',{target,mode:'read',code:'return {pageCount:presentation.getSlides().length,snapshot:JSON.parse(JSON.stringify(presentation.save()))};'});
 const status=await call('univer_status',{fileId:target.fileId});
 const worktree=status.worktrees.find(w=>w.worktreeID===target.worktreeId);
 assert.equal(result.mutations,0);assert.equal(result.value.pageCount,2);assert.equal(worktree.status,'ready');
 const evidence={target,result,worktree};
 if(phase==='after')assert.deepEqual(evidence,JSON.parse(await readFile('.data/slide-readonly-config-before.json','utf8')));
 await writeFile(`.data/slide-readonly-config-${phase}.json`,JSON.stringify(evidence,null,2));
 console.log(phase==='after'?'Full Slide snapshot and ready worktree unchanged after UI navigation.':'Current Slide baseline captured: two pages, ready, read mutations zero.');
}finally{await client.close();}
