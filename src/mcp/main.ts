#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {resolve} from 'node:path';
import {startServer} from '../server/main.js';
import {createOfficeMcpServer} from './server.js';

const workspace=process.env.WORKBUDDY_OFFICE_WORKSPACE;
if(!workspace || workspace.includes('${'))throw new Error('WORKBUDDY_OFFICE_WORKSPACE must be set by the host to an authorized workspace.');
const runtime=await startServer({workspace:resolve(workspace)});
const server=createOfficeMcpServer(runtime,resolve(workspace));
// Human launch stays separate from the model's tool results until host UI authorization is verified.
process.stderr.write('Univer Office MCP ready. Open previews and human review through the host UI.\n');
const transport=new StdioServerTransport();
await server.connect(transport);
let closing=false;
async function close(){if(closing)return;closing=true;await server.close();await runtime.close();}
process.stdin.once('end',()=>void close());
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void close().then(()=>process.exit(0)));
