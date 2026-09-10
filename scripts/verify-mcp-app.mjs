import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const fixture=JSON.parse(await readFile(process.argv[2]??'.data/comparison-target.json','utf8'));
const targets=fixture.targets??[fixture.target??fixture];
let target=targets[0];
const workspace=resolve(fixture.workspace??'.data/workspace');
// Reuse an existing runtime when checking the host card; never start a second owner for its workspace.
const httpConfig=fixture.httpConfig?JSON.parse(await readFile(fixture.httpConfig,'utf8')):undefined;
const transport=httpConfig
  ?new StreamableHTTPClientTransport(new URL(httpConfig.url),{requestInit:{headers:httpConfig.headers}})
  :new StdioClientTransport({command:process.execPath,args:[resolve('dist/mcp/main.js')],env:{...process.env,WORKBUDDY_OFFICE_WORKSPACE:workspace},stderr:'pipe'});
const client=new Client({name:'office-app-protocol-verifier',version:'0.1.0'});
await client.connect(transport);
const preview=()=>client.callTool({name:'univer_preview',arguments:{target,capture:fixture.capture??true}},undefined,{timeout:180000});
let result=await preview();if(result.isError)throw new Error(JSON.stringify(result));
const uri=(await client.listTools()).tools.find(tool=>tool.name==='univer_preview')._meta.ui.resourceUri;
const resource=await client.readResource({uri});
const script=await readFile('dist/test-host/host.js','utf8');
const secret=randomBytes(24).toString('hex');let origin='';
const selector=targets.length>1?`<label>测试目标 <select id="target">${targets.map((_,index)=>`<option value="${index}">样例 ${index+1}</option>`).join('')}</select></label>`:'';
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>MCP Apps 协议验证</title><style>body{margin:0;padding:24px;background:#eef3f1;color:#244136;font:14px system-ui}h1{font-size:20px}button,a{padding:7px 12px;margin:8px 8px 12px 0}iframe{width:100%;border:0;border-radius:12px;background:white;height:560px}body[data-mode=fullscreen] iframe{position:fixed;inset:0;height:100vh!important;z-index:2}body[data-mode=pip] iframe{position:fixed;right:20px;bottom:20px;width:520px;max-height:70vh;box-shadow:0 12px 40px #24413655;z-index:2}</style></head><body><h1>MCP Apps 协议验证环境</h1><p>官方 AppBridge + 沙箱 iframe；此页面不是 WorkBuddy 客户端。</p><button id="theme">切换宿主主题</button><button id="locale">切换宿主语言</button>${selector}<a id="open-link" hidden>进入目标审阅页</a><p id="status">等待握手…</p><pre id="events" aria-label="显示模式事件记录"></pre><iframe id="app" title="Univer Office 预览卡片" sandbox="allow-scripts allow-same-origin" ${process.argv.includes("--native-fullscreen")?'allow="fullscreen" allowfullscreen':''}></iframe><script>${script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
const server=createServer(async(req,res)=>{
  try{
    if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||!req.url.startsWith('/'+secret+'/')){res.writeHead(403);res.end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    const path=req.url.slice(secret.length+2);
    if(path===''){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    if(path==='resource'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(resource.contents[0].text);return;}
    if((path==='refresh'||path==='select')&&req.method==='POST'){
      let body='';for await(const part of req){body+=part;if(body.length>4096)throw new Error('Request too large');}
      const params=JSON.parse(body);
      if(path==='select'){
        if(!Number.isInteger(params.index)||!targets[params.index])throw new Error('Unknown fixture');
        target=targets[params.index];
      }else if(params.name!=='univer_preview'||JSON.stringify(params.arguments?.target)!==JSON.stringify(target))throw new Error('Only the selected preview is allowed');
      result=await preview();
    }else if(path!=='result'){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch(error){res.writeHead(400);res.end(String(error));}
});
await new Promise(yes=>server.listen(0,'127.0.0.1',yes));origin=`http://127.0.0.1:${server.address().port}`;
await writeFile('.data/mcp-app-verification.json',JSON.stringify({url:`${origin}/${secret}/`,target,imageCount:result.structuredContent.result.imageCount}),{mode:0o600});
console.log('Protocol test host ready; launch URL stored in .data/mcp-app-verification.json');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void(async()=>{server.closeAllConnections();server.close();await client.close();await transport.close();process.exit(0);})();});
