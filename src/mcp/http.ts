#!/usr/bin/env node
import {randomBytes} from 'node:crypto';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {startServer} from '../server/main.js';
import {createOfficeMcpServer} from './server.js';

/** All requests share one Office runtime; protocol objects are request-scoped. */
export async function startHttpMcpServer(options:{workspace:string;port?:number}) {
  const router=express.Router();
  const runtime=await startServer({...options,extensionRouter:router});
  const token=randomBytes(32).toString('hex');
  const active=new Set<ReturnType<typeof createOfficeMcpServer>>();
  let closing=false;
  router.use('/mcp',(req,res,next)=>{
    if(req.headers.authorization!==`Bearer ${token}`)return void res.status(401).json({error:'Authentication required'});
    if(closing)return void res.status(503).json({error:'Server is shutting down'});
    next();
  });
  router.post('/mcp',express.json({limit:'4mb'}),async(req,res,next)=>{
    const server=createOfficeMcpServer(runtime,resolve(options.workspace));
    active.add(server);
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    const dispose=()=>{active.delete(server);void server.close().catch(()=>{});};
    res.once('close',dispose);
    try {
      await server.connect(transport);
      await transport.handleRequest(req,res,req.body);
    } catch(error) {
      dispose();
      if(!res.headersSent)next(error);
      else res.end();
    }
  });
  router.all('/mcp',(_req,res)=>{res.setHeader('Allow','POST');res.status(405).json({error:'Method not allowed'});});
  return {...runtime,url:`${runtime.origin}/mcp`,token,
    async close(){
      if(closing)return;
      closing=true;
      await Promise.allSettled([...active].map(server=>server.close()));
      await runtime.close();
    }};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const workspace=process.env.WORKBUDDY_OFFICE_WORKSPACE;
  if(!workspace||workspace.includes('${'))throw new Error('WORKBUDDY_OFFICE_WORKSPACE must identify an authorized workspace.');
  const runtime=await startHttpMcpServer({workspace:resolve(workspace),port:Number(process.env.PORT??9080)});
  const destination=resolve(process.env.WORKBUDDY_OFFICE_HTTP_CONFIG??'.data/http-mcp-runtime.json');
  await mkdir(dirname(destination),{recursive:true});
  const temporary=`${destination}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary,JSON.stringify({url:runtime.url,headers:{Authorization:`Bearer ${runtime.token}`}}),{mode:0o600,flag:'wx'});
  await rename(temporary,destination);
  process.stderr.write(`Office HTTP MCP: ${runtime.url}; credentials saved in ${destination}\n`);
  for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void runtime.close().then(()=>process.exit(0)));
}
