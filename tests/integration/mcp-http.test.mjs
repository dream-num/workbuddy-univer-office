import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {startHttpMcpServer} from '../../dist/mcp/http.js';

await test('HTTP MCP authenticates discovery and shares durable Office state across clients',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'office-http-'));
  const runtime=await startHttpMcpServer({workspace,port:0});
  const clients=[];
  const headers={Authorization:`Bearer ${runtime.token}`};
  try {
    assert.equal((await fetch(runtime.url,{method:'POST'})).status,401);
    assert.equal((await fetch(runtime.url,{method:'POST',headers:{...headers,Origin:'https://untrusted.invalid'}})).status,403);
    const invalidHost=await new Promise((resolve,reject)=>{
      const req=request(runtime.url,{method:'POST',headers:{...headers,Host:'untrusted.invalid'}},res=>{res.resume();resolve(res.statusCode);});
      req.on('error',reject);req.end();
    });
    assert.equal(invalidHost,403);
    assert.equal((await fetch(runtime.url,{headers})).status,405);
    assert.equal((await fetch(runtime.origin+'/api/files',{headers})).status,401,'MCP credential must not grant backend/viewer access');
    for(let i=0;i<2;i++){
      const client=new Client({name:`http-test-${i}`,version:'1'});
      clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(runtime.url),{requestInit:{headers}}));
    }
    const tools=await clients[0].listTools();
    assert.equal(tools.tools.length,15);
    const uri=tools.tools.find(t=>t.name==='univer_preview')._meta.ui.resourceUri;
    const resource=await clients[1].readResource({uri});
    assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
    assert.ok(!resource.contents[0].text.includes('ticket='));
    const created=await clients[0].callTool({name:'univer_new',arguments:{file:'shared.univer'}});
    assert.ok(!created.isError,JSON.stringify(created));
    const fileId=created.structuredContent.result.fileId;
    const status=await clients[1].callTool({name:'univer_status',arguments:{fileId}});
    assert.equal(status.structuredContent.result.fileId,fileId);
    const duplicate=await clients[1].callTool({name:'univer_new',arguments:{file:'shared.univer'}});
    assert.equal(duplicate.isError,true);
  } finally {
    await Promise.allSettled(clients.map(client=>client.close()));
    await runtime.close();
    await rm(workspace,{recursive:true,force:true});
  }
});
