import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const phase=process.argv[2];assert.ok(['before','after'].includes(phase));
const config=JSON.parse(await readFile('.data/http-mcp-runtime.json','utf8'));
const target={fileId:'b44d45d4-27fd-4eb3-a8da-0de7b0132ec2',unitId:'f5b90aeb-5cf9-49e0-a36a-567992df3d02',worktreeId:'cd21c706-d6f0-4cde-adb7-004d1b35f532',branch:'worktree'};
const client=new Client({name:'dev-update-verifier',version:'1'});
const transport=new StreamableHTTPClientTransport(new URL(config.url),{requestInit:{headers:config.headers}});
try{
 await client.connect(transport);
 const call=async(name,args)=>{const r=await client.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r.content));return r.structuredContent.result;};
 const status=await call('univer_status',{fileId:target.fileId});
 const preview=await call('univer_preview',{target,capture:false});
 assert.equal(preview.state,'ready');
 const record={status,preview};
 if(phase==='after'){
  const before=JSON.parse(await readFile('.data/dev-http-before.json','utf8'));
  assert.deepEqual(status,before.status,'Persisted status changed across service restart');
  assert.equal(preview.previewAccess,'read-only');assert.equal(preview.worktreeEditable,false);assert.equal(preview.awaitingHumanReview,true);assert.equal(preview.revision,null);
 }
 await writeFile(`.data/dev-http-${phase}.json`,JSON.stringify(record,null,2));
 console.log(`${phase}: ready draft verified; ${phase==='after'?'status unchanged and corrected semantics present':'baseline saved'}`);
}finally{await client.close();await transport.close();}
