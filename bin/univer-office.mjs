#!/usr/bin/env node
import {isAbsolute} from 'node:path';
import {readFileSync} from 'node:fs';

const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--version'){
 console.log(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);
}else if(args.length===1&&args[0]==='--help'){
 console.log('Univer Office local stdio MCP server\nSet WORKBUDDY_OFFICE_WORKSPACE to an absolute, authorized local directory.\nStart with: univer-office\nThe host manages the process; no cloud service or HTTP token is required.');
}else{
 if(args.length)throw new Error('Unsupported arguments. Use --help for usage.');
 const workspace=process.env.WORKBUDDY_OFFICE_WORKSPACE;
 if(!workspace||workspace.includes('${')||!isAbsolute(workspace))throw new Error('Set WORKBUDDY_OFFICE_WORKSPACE to an absolute, authorized local directory in the connector configuration.');
 await import('../dist/mcp/main.js');
}
