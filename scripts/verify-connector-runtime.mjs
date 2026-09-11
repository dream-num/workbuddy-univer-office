import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const specification=process.argv[2];
assert.ok(specification,'Pass the actual npm runtime tarball path or public URL.');
const workspace=await mkdtemp(resolve('.data/connector-sheet-'));
const cache=resolve('.data/connector-clean-install/npm-cache');
const transport=new StdioClientTransport({command:'npx',args:['--yes','--prefer-offline','--package='+specification,'univer-office'],cwd:workspace,env:{
 PATH:process.env.PATH,HOME:process.env.HOME,
 npm_config_userconfig:'/dev/null',npm_config_cache:cache,
 npm_config_registry:'https://insider-npm-registry.univer.work/',npm_config_maxsockets:'3',
 WORKBUDDY_OFFICE_WORKSPACE:workspace,
},stderr:'pipe'});
const client=new Client({name:'connector-install-verifier',version:'1.0.0'});
try{
 await client.connect(transport,{timeout:120000});
 const call=async(name,args)=>{
  const result=await client.callTool({name,arguments:args},undefined,{timeout:120000});
  assert.ok(!result.isError,JSON.stringify(result.content));return result;
 };
 assert.equal((await client.listTools()).tools.length,15);
 const fileId=(await call('univer_new',{file:'connector-sales.univer'})).structuredContent.result.fileId;
 const worktreeId=(await call('univer_worktree',{fileId,action:'create'})).structuredContent.result.worktreeID;
 const unitId=(await call('univer_unit',{fileId,worktreeId,kind:'sheet',name:'连接器销售表'})).structuredContent.result.unitId;
 const target={fileId,worktreeId,unitId,branch:'worktree'};
 const written=await call('univer_execute',{target,mode:'write',code:"const sheet=workbook.getActiveSheet();sheet.getRange('A1:B4').setValues([['项目','金额'],['华东',1200],['华南',800],['合计','=SUM(B2:B3)']]);sheet.setColumnWidth(0,160);sheet.setColumnWidth(1,120);return true;"});
 assert.equal(written.structuredContent.result.commit,'confirmed');
 const checked=(await call('univer_execute',{target,mode:'read',code:"return {value:workbook.getActiveSheet().getRange('B4').getValue(),sheetName:workbook.getActiveSheet().getSheetName()};"})).structuredContent.result.value;
 assert.equal(checked.value,2000);
 const shot=await call('univer_screenshot',{target,selector:{kind:'sheet-range',sheetName:checked.sheetName,range:'A1:D8',scale:1}});
 const picture=shot.content.find(item=>item.type==='image');assert.equal(picture?.mimeType,'image/png');
 await writeFile('.data/packages/connector-sheet.png',Buffer.from(picture.data,'base64'));
 await call('univer_export',{target,output:'connector-sales.xlsx'});
 assert.ok((await readFile(join(workspace,'connector-sales.xlsx'))).length>100);
 const preview=await call('univer_preview',{target,capture:false});
 assert.equal(preview.structuredContent.result.previewAccess,'read-only');
 const resource=await client.readResource({uri:preview._meta.ui.resourceUri});
 assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
 assert.match(resource.contents[0].text,/<script>/);
 assert.equal((await fetch(preview._meta.office.previewUrl)).status,200);
 const report={package:specification,workspace,target,tools:15,formula:2000,confirmed:true,screenshot:'.data/packages/connector-sheet.png',xlsx:'connector-sales.xlsx',appResource:true,previewPage:true,actualWorkBuddyPanelVerified:false};
 await writeFile('.data/connector-runtime-verification.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS: npx runtime starts in isolated workspace; 15 tools; confirmed Sheet write; SUM=2000; PNG and XLSX; App resource and preview HTTP 200. WorkBuddy panel requires host verification.');
}finally{await client.close();await transport.close();}
