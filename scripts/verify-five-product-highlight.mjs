import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const phase=process.argv[2];assert.ok(['before','after'].includes(phase));
const config=JSON.parse(await readFile('.data/http-mcp-runtime.json','utf8'));
const client=new Client({name:'five-product-highlight-verifier',version:'1'});
await client.connect(new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:config.headers}}));
try{
 const evidence={},launches={};
 for(const[kind,name,variable]of [['sheet','workbuddy-host','workbook'],['doc','doc-live','doc'],['slide','slide-live','presentation'],['base','base-live','base'],['board','board-live','board']]){
  const{target}=JSON.parse(await readFile(`.data/${name}-verification.json`,'utf8'));
  const result=await client.callTool({name:'univer_execute',arguments:{target,mode:'read',code:`return JSON.parse(JSON.stringify(${variable}.save()));`}});
  assert.ok(!result.isError,`${kind}: ${JSON.stringify(result.content)}`);
  evidence[kind]=result.structuredContent.result.value;
  if(phase==='before'){
   const preview=await client.callTool({name:'univer_preview',arguments:{target}});assert.ok(!preview.isError);
   launches[kind]=preview._meta.office.launchUrl;
  }
  console.log(`${kind}: snapshot read`);
 }
 if(phase==='after')assert.deepEqual(evidence,JSON.parse(await readFile('.data/five-product-highlight-before.json','utf8')));
 await writeFile(`.data/five-product-highlight-${phase}.json`,JSON.stringify(evidence,null,2));
 if(phase==='before')await writeFile('.data/five-product-highlight-launches.json',JSON.stringify(launches),{mode:0o600});
 console.log(phase==='after'?'All five original snapshots unchanged.':'Captured five-product baseline.');
}finally{await client.close();}
