import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAppTool,registerAppResource,RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server';
import {z} from 'zod';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createStandardApiReference} from '@univer-cli/api-reference';
import {compileSvgToFacade,wrapSlideScript} from '@univer-cli/svg-facade';
import {createResourceLibrary,FilesystemResourceCache,HttpsResourceDownloader,loadResourceManifestFromPath} from '@univer-cli/resource-library';
import {publish} from '../application/delivery.js';
import type {startServer} from '../server/main.js';
import {kinds} from '../shared/contracts.js';

export function createOfficeMcpServer(runtime:Awaited<ReturnType<typeof startServer>>,workspace:string) {
const officeLogo=`data:image/png;base64,${readFileSync(new URL('../../assets/univer-office.png',import.meta.url)).toString('base64')}`;
const server=new McpServer({name:'workbuddy-univer-office',title:'Univer Office',version:'0.1.0',icons:[{src:officeLogo,mimeType:'image/png',sizes:['1081x1081']} ]});
const target=z.object({fileId:z.string(),unitId:z.string(),branch:z.enum(['trunk','worktree']),worktreeId:z.string().optional()});
async function api(path:string,body?:unknown):Promise<any>{
  const response=await fetch(runtime.origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${runtime.agentToken}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw new Error(`${value.code}: ${value.message}`);return value;
}
function register(name:string,description:string,inputSchema:z.ZodRawShape,fn:(input:any)=>Promise<any>,readOnly=false){
  server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:false,openWorldHint:false}},async input=>{
    try {
      const value=await fn(input);
      const summary=value?.images?{...value,images:value.images.map(({data,...image}:any)=>image)}:value;
      const content:any[]=[{type:'text',text:JSON.stringify(summary)}];
      if(value?.images)for(const image of value.images)content.push({type:'image',mimeType:'image/png',data:image.data});
      return {content,structuredContent:{schemaVersion:1,result:summary}};
    }catch(error){return{isError:true,content:[{type:'text',text:error instanceof Error?error.message:String(error)}]};}
  });
}
register('univer_new','Create an empty local Office container using a new workspace-relative .univer filename, for example sales-review.univer. This creates the container, not an XLSX file; create a worktree and Unit next, then use univer_export for standard Office delivery. Do not infer the configured storage directory from the host current directory. Existing files are never overwritten.',{file:z.string().min(1).describe('New filename ending in .univer, relative to this MCP server\'s configured workspace. Prefer a basename such as sales-review.univer; any parent directory must already exist.')},input=>api('/files',input));
register('univer_status','Read files, content directory and authoritative worktree states.',{fileId:z.string().optional()},input=>api(input.fileId?`/files/${input.fileId}`:'/files'),true);
register('univer_worktree','Create or freeze/reopen a draft. Merge/discard requests require a separate human review and return pending-review.',{fileId:z.string(),action:z.enum(['create','ready','reopen','merge','discard']),worktreeId:z.string().optional(),unitIds:z.array(z.string()).optional()},input=>{
  if(input.action==='create')return api(`/files/${input.fileId}/worktrees`,{unitIds:input.unitIds??[]});
  if(!input.worktreeId)throw new Error('worktreeId is required');
  return api(`/files/${input.fileId}/review/${input.worktreeId}`,{action:input.action});
});
register('univer_unit','Create content or mark a Unit for reviewed removal inside a draft. remove preserves trunk until human merge; restore undoes a pending removal in an editable draft. create requires kind/name. A new Sheet initially contains a worksheet named 数据.',{fileId:z.string(),worktreeId:z.string(),action:z.enum(['create','remove','restore']).default('create'),kind:z.enum(kinds).optional(),name:z.string().optional(),unitId:z.string().optional()},input=>{
  if(input.action==='create'){
    if(!input.kind||!input.name)throw new Error('create requires kind and name');
    return api(`/files/${input.fileId}/units`,{worktreeId:input.worktreeId,kind:input.kind,name:input.name});
  }
  if(!input.unitId)throw new Error('remove/restore requires unitId');
  return api(`/files/${input.fileId}/units/${input.unitId}/removal`,{worktreeId:input.worktreeId,removed:input.action==='remove'});
});
register('univer_import','Import XLSX, CSV, TSV, DOCX or PPTX into a draft; source remains intact.',{fileId:z.string(),worktreeId:z.string(),source:z.string(),name:z.string().optional()},input=>api(`/files/${input.fileId}/import`,input));
register('univer_execute','Execute public Facade JavaScript in a separate content process. Available bindings: api/univerAPI (FUniver), workbook for Sheet, doc for Doc, presentation for Slide, base for Base, board for Board. No worksheet binding: select it from workbook. Top-level await and return are supported; return JSON-compatible primitives or data, never Facade instances. Writes require draft; confirmed commit is checked. Read back formula results after calculation. Never rerun an unknown write blindly.',{target,mode:z.enum(['read','write']),code:z.string().optional(),codeFile:z.string().optional()},async input=>{
  if(Boolean(input.code)===Boolean(input.codeFile))throw new Error('Provide exactly one of code and codeFile');
  const code=input.code??await readFile(await runtime.office.path(input.codeFile),'utf8');
  return api('/content',{target:input.target,mode:input.mode,code,action:'execute'});
});
register('univer_inspect','Read content using the installed CLI SDK inspection query union.',{target,query:z.record(z.unknown())},input=>api('/content',{...input,action:'inspect',mode:'read'}),true);
register('univer_export','Export a confirmed selected version to a new XLSX, CSV, TSV, DOCX or PPTX file. Draft exports do not merge. Base requires explicit baseSelection; a view exports visible fields and filtered/sorted rows.',{target,output:z.string(),baseSelection:z.object({tableId:z.string().min(1),viewId:z.string().min(1).optional()}).strict().optional()},input=>api('/delivery',{...input,action:'export'}));
register('univer_screenshot','Capture actual SDK-rendered PNG images. Maximum 30 pages and 16,777,216 pixels per image.',{target,selector:z.record(z.unknown()).optional(),output:z.string().optional()},input=>api('/delivery',{...input,action:'screenshot'}),true);
register('univer_print_pdf','Print Sheet, Doc, Slide or Board into a new PDF file. Base PDF is unsupported.',{target,output:z.string()},input=>api('/delivery',{...input,action:'pdf'}));
register('univer_lint','Run SDK Slide layout lint and report coverage plus findings.',{target,pages:z.array(z.union([z.number(),z.string()])).optional()},input=>api('/delivery',{...input,action:'lint'}),true);
// Hosts cache UI resources by URI. A new build must not replay stale card code.
const previewHtml=readFileSync(new URL('../mcp-app/index.html',import.meta.url),'utf8');
const previewScript=readFileSync(new URL('../mcp-app/app.js',import.meta.url),'utf8');
const previewStyle=readFileSync(new URL('../mcp-app/app.css',import.meta.url),'utf8');
const previewVersion=createHash('sha256').update(previewHtml).update(previewScript).update(previewStyle).digest('hex').slice(0,16);
const previewUri=`ui://workbuddy-univer-office/preview/${previewVersion}`;
registerAppTool(server,'univer_preview',{
  description:'Show a read-only Office preview card after confirmed edits or on explicit request. ready means frozen and awaiting human review, not editable. A null revision means no captured revision was supplied, not that there are no changes. Editing/review opens separately. Does not merge or discard.',
  inputSchema:{target,capture:z.boolean().default(true)},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},_meta:{ui:{resourceUri:previewUri},workbuddy:{ui:{launchSurface:'panel'}}},
},async({target:selected,capture})=>{
  try{
    const {unit}=await runtime.office.resolveTarget(selected);
    const status=await runtime.office.status(selected.fileId);
    const draft=selected.branch==='worktree'?status.worktrees.find(w=>w.worktreeID===selected.worktreeId):undefined;
    const rendered=capture?await api('/delivery',{target:selected,action:'screenshot'}):undefined;
    const launch=new URL(runtime.launchUrl);launch.searchParams.set('file',selected.fileId);launch.searchParams.set('unit',selected.unitId);
    if(selected.worktreeId)launch.searchParams.set('worktree',selected.worktreeId);
    const previewUrl=await runtime.createPreview(selected);
    const state=draft?.status??'trunk';
    const result={target:selected,name:unit.name,kind:unit.kind,state,
      previewAccess:'read-only',worktreeEditable:state==='draft',awaitingHumanReview:state==='ready',
      revision:rendered?.revision??null,revisionMeaning:'Captured image revision; null means no capture revision supplied, not no pending changes.',
      capturedAt:rendered?new Date().toISOString():null,imageCount:rendered?.images?.length??0};
    return{content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:{schemaVersion:1,result},
      _meta:{ui:{resourceUri:previewUri},workbuddy:{ui:{launchSurface:'panel'}},office:{launchUrl:launch.href,previewUrl,images:rendered?.images?.map((image:any)=>({data:image.data,width:image.width,height:image.height}))??[]}}};
  }catch(error){return{isError:true,content:[{type:'text' as const,text:error instanceof Error?error.message:String(error)}]};}
});
registerAppResource(server,'office-preview',previewUri,{description:'Office preview and human review entry',mimeType:RESOURCE_MIME_TYPE},async()=>{
  return{contents:[{uri:previewUri,mimeType:RESOURCE_MIME_TYPE,text:previewHtml.replace('<!-- APP_STYLE -->',()=>`<style>${previewStyle}</style>`).replace('<!-- APP_SCRIPT -->',()=>`<script>${previewScript.replace(/<\/script/gi,'<\\/script')}</script>`),_meta:{ui:{prefersBorder:true,csp:{resourceDomains:[],connectDomains:[],frameDomains:[runtime.origin]}}}}]};
});
register('univer_compile_svg','Compile SVG into a native Slide page, execute in a draft and commit. Report compiler diagnostics.',{target,source:z.string(),page:z.number().int().positive(),mode:z.enum(['append','replace'])},async input=>{
  const resolved=await runtime.office.resolveTarget(input.target,'write');if(resolved.unit.kind!=='slide')throw new Error('SVG compilation requires a Slide target');
  const compiled=await compileSvgToFacade(input.source);
  const code=wrapSlideScript(compiled.code,{page:input.page,mode:input.mode==='append'?'add':'replace',...compiled.viewport});
  const result=await api('/content',{target:input.target,action:'execute',mode:'write',code});return{...result,diagnostics:{...compiled,code:undefined}};
});
const reference=createStandardApiReference();
register('univer_api','Search or show public Facade API documentation from the exact installed SDK. Search terms are identifiers.',{action:z.enum(['find','show']),queries:z.array(z.string()).optional(),symbols:z.array(z.string()).optional(),unit:z.enum(kinds).optional(),limit:z.number().int().positive().max(100).optional()},async input=>input.action==='find'?reference.find({terms:input.queries??[],unit:input.unit,limit:input.limit}):reference.show(input.symbols??[]),true);
{
  const manifestPath=process.env.UNIVER_RESOURCE_MANIFEST??createRequire(import.meta.url).resolve('@univerjs-pro/cli-assets/manifest.json');
  const library=createResourceLibrary({manifest:loadResourceManifestFromPath(manifestPath),cache:new FilesystemResourceCache(resolve(workspace,'.office-resource-cache')),downloader:new HttpsResourceDownloader(),output:{async write(destination,filename,svg){const output=await runtime.office.path(join(destination,filename),false);await publish(output,Buffer.from(svg));return output;}}});
  register('univer_resources','Search, read and export assets from the configured trusted resource manifest.',{action:z.enum(['list','find','read','export']),queries:z.array(z.string()).optional(),handles:z.array(z.string()).optional(),registries:z.array(z.string()).optional(),output:z.string().optional()},async input=>{
    if(input.action==='list')return library.listRegistries();
    if(input.action==='find')return library.find({queries:input.queries??[],registries:input.registries});
    if(input.action==='read')return Promise.all((input.handles??[]).map((handle:string)=>library.read({handle})));
    if(!input.output)throw new Error('output is required');
    const output=await runtime.office.path(input.output);return library.export({handles:input.handles??[],destination:output});
  });
}
server.registerResource('office-status','office://status',{description:'Implementation and host compatibility status',mimeType:'application/json'},async()=>({contents:[{uri:'office://status',mimeType:'application/json',text:JSON.stringify({stage:'development',viewer:'browser editing/review with basic history restore verified',mcpApps:'WorkBuddy 5.5.4 HTTP: basic five-kind read-only live preview and fullscreen verified; full review, task isolation and installation remain incomplete',resourceLibrary:true,workspace})}]}));
return server;
}
