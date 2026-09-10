import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { z } from 'zod';
import { Office,emptyUnit,protocolTypes } from '../application/office.js';
import { runContent } from '../application/content-worker.js';
import { OfficeError, kinds, type Target } from '../shared/contracts.js';
import type { Principal } from '../storage/file-context.js';
import type { ContentInspectionQuery } from '@univer-cli/content-inspection';
import {ErrorCode,UnitAction} from '@univerjs/protocol';
import {VisualDelivery,exportOffice,publish} from '../application/delivery.js';
import type {UniverRenderUnit} from '@univer-cli/univer-render-runtime';
import type {UnitScreenshotInput} from '@univer-cli/unit-screenshot';
import {compare,comparisonHeads,ComparisonPages,type ComparisonSnapshot,type ComparisonRecord} from '../application/comparison.js';
import {PreviewSessions} from './preview.js';
import {prepareHistoryRestore,confirmHistoryRestore,cancelHistoryRestore} from '../application/history-restore.js';
import {EditSessions} from '../shared/edit-sessions.js';
import {previewPrincipal} from '../shared/preview-principal.js';
import {acquireWorkspaceLease} from '../storage/workspace-lease.js';

export async function startServer(options: {workspace:string;port?:number;extensionRouter?:express.Router}) {
  await mkdir(options.workspace,{recursive:true});
  const workspace = await realpath(options.workspace);
  const release=acquireWorkspaceLease(workspace);
  try {
    const runtime=await startOwnedServer({...options,workspace});
    let closing:Promise<void>|undefined;
    return {...runtime,close(){return closing??=runtime.close().finally(release);}};
  } catch(error){release();throw error;}
}

async function startOwnedServer(options: {workspace:string;port?:number;extensionRouter?:express.Router}) {
  const workspace=options.workspace;
  const agentToken = randomBytes(32).toString('hex'), launchToken=randomBytes(32).toString('hex'), viewerToken=randomBytes(32).toString('hex');
  let origin='';
  const viewerCookie=()=>`wb_office_${new URL(origin).port}`;
  const previews=new PreviewSessions();
  const edits=new EditSessions();
  function authenticate(req:IncomingMessage):Principal|undefined {
    const preview=previews.scope(req);if(preview)return previewPrincipal(preview);
    if (req.headers.authorization === `Bearer ${agentToken}`) return 'agent';
    if (req.headers.cookie?.split(';').some(c => c.trim() === `${viewerCookie()}=${viewerToken}`)){
      const source=new URL((req as IncomingMessage&{originalUrl?:string}).originalUrl??req.url??'/',origin);
      const token=source.pathname.match(/^\/edit\/([a-f0-9]{64})(?=\/)/)?.[1]??source.searchParams.get('editSession');
      return token?edits.principal(token):'viewer';
    }
    return undefined;
  }
  const office = new Office(workspace, authenticate, edits);
  const visual = new VisualDelivery();
  const comparisonPages=new ComparisonPages();
  try {
  await office.init();
  const app=express();
  app.disable('x-powered-by');
  app.use((req,res,next) => {
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.headers.host !== new URL(origin || 'http://127.0.0.1').host) return void res.status(403).send('Invalid host');
    if (req.headers.origin && req.headers.origin !== origin) return void res.status(403).send('Invalid origin');
    previews.attach(req);
    next();
  });
  // SDK URL resolution preserves path prefixes but drops base URL query strings.
  app.use((req,_res,next)=>{req.url=req.url.replace(/^\/edit\/[a-f0-9]{64}(?=\/(?:api|files)\/)/,'');next();});
  app.get('/launch',async(req,res) => {
    if (req.query.ticket !== launchToken) return void res.status(401).send('Invalid launch ticket');
    const destination=new URL('/',origin);
    if(req.query.file||req.query.unit){
      const input=z.object({file:z.string(),unit:z.string(),worktree:z.string().optional(),review:z.string().optional()}).parse(req.query);
      await office.resolveTarget({fileId:input.file,unitId:input.unit,branch:input.worktree?'worktree':'trunk',worktreeId:input.worktree});
      destination.searchParams.set('file',input.file);destination.searchParams.set('unit',input.unit);
      if(input.worktree)destination.searchParams.set('worktree',input.worktree);
      if(input.review){
        await office.reviewState(input.file,input.review);
        destination.searchParams.set('review',input.review);
      }
    }
    res.setHeader('Set-Cookie',`${viewerCookie()}=${viewerToken}; HttpOnly; SameSite=Strict; Path=/`);
    res.redirect(303,destination.pathname+destination.search);
  });
  app.get('/health',(_req,res) => res.json({application:'workbuddy-univer-office',version:'0.1.0',stage:'development'}));
  app.use(['/api','/files'],(req,res,next) => {
    const principal=authenticate(req);
    if (!principal) return void res.status(401).json({code:'AUTH_REQUIRED',message:'Open the authenticated launch link.'});
    res.locals.principal=principal; next();
  });
  app.use('/files/:fileId',(req,res) => {
    const file=office.file(req.params.fileId);
    // Express removes only the application prefix, retaining the SDK protocol path.
    file.transport.handleRequest(req,res);
  });
  app.use('/api',express.json({limit:'4mb'}));
  app.get('/api/preview/resolve',async(req,res)=>{
    const target=previews.scope(req);
    if(!target)throw new OfficeError('PREVIEW_REQUIRED','A scoped preview is required.',403);
    const status=await office.status(target.fileId);
    const draft=status.worktrees.find(item=>item.worktreeID===target.worktreeId);
    const state=target.branch==='trunk'?'trunk':draft?.status;
    if(state==='merged'||state==='discarded'){
      const unit=status.units.find(item=>item.unitId===target.unitId&&!item.removed&&!item.worktreeId);
      // A discarded draft-only Unit has no trunk counterpart. Never select a
      // different Unit or broaden the original capability to the entire file.
      const next:Target={fileId:target.fileId,unitId:target.unitId,branch:'trunk'};
      if(unit)await office.resolveTarget(next);
      res.json({state,review:state,available:Boolean(unit),previewUrl:unit?previews.issue(next,origin,state):null});
      return;
    }
    if(draft?.units.some(unit=>unit.unitID===target.unitId&&unit.removed)){
      res.json({state,review:null,removed:true,available:false,previewUrl:null});return;
    }
    await office.resolveTarget(target);
    res.json({state,review:previews.review(req)??null,available:true,previewUrl:null});
  });
  app.post('/api/files/:fileId/permissions/:branch/-/object/-/batch_allowed',async(req,res)=>{
    const file=office.file(req.params.fileId);
    const draft=req.params.branch==='trunk'?undefined:(await file.worktrees.getWorktree({worktreeID:req.params.branch},{userID:'application'})).worktree;
    const readActions=new Set([UnitAction.View,UnitAction.Copy,UnitAction.SelectProtectedCells,UnitAction.SelectUnProtectedCells]);
    if(!draft&&authenticate(req)==='viewer')readActions.add(UnitAction.ViewHistory);
    const body=z.object({requests:z.array(z.object({unitID:z.string(),objectID:z.string(),actions:z.array(z.number())}))}).parse(req.body);
    res.json({error:{code:ErrorCode.OK,message:''},objectActions:body.requests.map(item=>({...item,actions:item.actions.map(action=>({action,
      allowed:action!==UnitAction.RecoverHistory&&(action!==UnitAction.ViewHistory||readActions.has(action))&&(!previews.scope(req)||previews.scope(req)!.unitId===item.unitID)&&file.catalog.units().some(u=>u.unitId===item.unitID&&!u.removed)&&(draft?draft.units.some(u=>u.unitID===item.unitID&&!u.removed):!file.catalog.units().find(u=>u.unitId===item.unitID)?.worktreeId)&&(readActions.has(action)||((res.locals.principal==='agent'&&draft?.status==='draft')||(!draft&&edits.allows(res.locals.principal,req.params.fileId,'trunk',item.unitID))))
    }))}))});
  });
  app.get('/api/files',(req,res) => res.json(office.list().filter(file=>!previews.scope(req)||file.fileId===previews.scope(req)!.fileId)));
  app.post('/api/files', async (req,res) => {
    const {file}=z.object({file:z.string().min(1)}).parse(req.body);
    const created=await office.serial(()=>office.open(file,true)); res.json({fileId:created.catalog.fileId});
  });
  app.get('/api/files/:fileId',async (req,res) => {
    const status=await office.status(req.params.fileId),scope=previews.scope(req);
    if(scope){status.units=status.units.filter(unit=>unit.unitId===scope.unitId);status.worktrees=status.worktrees.filter(draft=>draft.worktreeID===scope.worktreeId).map(draft=>({...draft,units:draft.units.filter(unit=>unit.unitID===scope.unitId)}));}
    res.json(status);
  });
  app.post('/api/files/:fileId/worktrees',async (req,res) => {
    const {unitIds}=z.object({unitIds:z.array(z.string()).default([])}).parse(req.body);
    res.json(await office.serial(()=>office.createWorktree(req.params.fileId,unitIds)));
  });
  app.post('/api/files/:fileId/units',async (req,res) => {
    const input=z.object({worktreeId:z.string(),kind:z.enum(kinds),name:z.string().min(1).max(200)}).parse(req.body);
    res.json(await office.serial(()=>office.createUnit(req.params.fileId,input.worktreeId,input.kind,input.name)));
  });
  app.post('/api/files/:fileId/units/:unitId/removal',async(req,res)=>{
    const input=z.object({worktreeId:z.string(),removed:z.boolean()}).strict().parse(req.body);
    res.json(await office.serial(()=>office.setUnitRemoved(req.params.fileId,input.worktreeId,req.params.unitId,input.removed)));
  });
  app.get('/api/files/:fileId/removed-units',async(req,res)=>{
    if(res.locals.principal!=='viewer')throw new OfficeError('VIEWER_REQUIRED','Directory recovery requires an authenticated review page.',403);
    res.json(await office.serial(()=>office.removedUnits(req.params.fileId)));
  });
  app.post('/api/files/:fileId/removed-units/:unitId/restore',async(req,res)=>{
    const {fingerprint}=z.object({fingerprint:z.string().length(64)}).strict().parse(req.body);
    res.json(await office.serial(()=>office.restoreRemovedUnit(req.params.fileId,req.params.unitId,fingerprint,res.locals.principal)));
  });
  app.post('/api/files/:fileId/import',async(req,res)=>{
    const input=z.object({worktreeId:z.string(),source:z.string(),name:z.string().optional()}).parse(req.body);
    res.json(await office.serial(()=>office.importUnit(req.params.fileId,input.worktreeId,input.source,input.name)));
  });
  app.get('/api/files/:fileId/review/:worktreeId',async(req,res)=>res.json(await office.reviewState(req.params.fileId,req.params.worktreeId)));
  app.post('/api/files/:fileId/review/:worktreeId',async(req,res)=>{
    const input=z.object({action:z.enum(['ready','reopen','merge','discard']),fingerprint:z.string().optional()}).parse(req.body);
    res.json(await office.serial(()=>office.action(req.params.fileId,req.params.worktreeId,input.action,res.locals.principal,input.fingerprint)));
  });
  app.post('/api/files/:fileId/history/list',async(req,res)=>{
    const input=z.object({unitId:z.string(),lastLabel:z.string().optional()}).strict().parse(req.body);
    if(res.locals.principal!=='viewer'&&!office.canEditTrunk(res.locals.principal,req.params.fileId,input.unitId))throw new OfficeError('VIEWER_REQUIRED','History review requires access to this content.',403);
    const {file,unit}=await office.resolveTarget({fileId:req.params.fileId,unitId:input.unitId,branch:'trunk'});
    const history=await file.history.getHistoryList({unitID:input.unitId,length:50,lastLabel:input.lastLabel},{userID:'viewer'});
    const head=await file.service.getUnitLoadData({unitID:input.unitId,type:protocolTypes[unit.kind],revision:0},{userID:'viewer'});
    res.json({unitName:unit.name,currentRevision:head.targetRevision,hasMore:history.hasMore,lastLabel:history.lastLabel,versions:history.historyIds.map(id=>({id,revision:history.entities.datas[id]!.endRevision,createdAt:history.entities.datas[id]!.createTime}))});
  });
  app.post('/api/files/:fileId/history/prepare',async(req,res)=>{
    const input=z.object({unitId:z.string(),revision:z.number().int().positive()}).strict().parse(req.body);
    res.json(await office.serial(()=>prepareHistoryRestore(office,req.params.fileId,input.unitId,input.revision,res.locals.principal)));
  });
  app.post('/api/files/:fileId/history/cancel',async(req,res)=>{
    const input=z.object({operationId:z.string().uuid()}).strict().parse(req.body);
    res.json(await office.serial(()=>cancelHistoryRestore(office,req.params.fileId,input.operationId,res.locals.principal)));
  });
  app.post('/api/files/:fileId/history/confirm',async(req,res)=>{
    const input=z.object({operationId:z.string().uuid()}).strict().parse(req.body);
    res.json(await office.serial(()=>confirmHistoryRestore(office,req.params.fileId,input.operationId,res.locals.principal)));
  });
  const targetSchema=z.object({fileId:z.string(),unitId:z.string(),branch:z.enum(['trunk','worktree']),worktreeId:z.string().optional()});
  app.post('/api/edit-sessions',async(req,res)=>{
    if(res.locals.principal!=='viewer')throw new OfficeError('VIEWER_REQUIRED','Editing requires confirmation in the review page.',403);
    const input=z.object({target:targetSchema,confirmed:z.literal(true),fingerprint:z.string().optional()}).strict().parse(req.body);
    res.json(await office.serial(async()=>{
      const target:Target=input.target;
      if(target.branch!=='trunk'||target.worktreeId)throw new OfficeError('WORKTREE_READ_ONLY','Worktree content cannot be edited in the review page. Confirm merge first.',403);
      await office.resolveTarget(target);
      const status=await office.status(target.fileId);
      const merged=status.worktrees.some(worktree=>worktree.status==='merged'&&worktree.units.some(unit=>unit.unitID===target.unitId&&['merged','unchanged'].includes(unit.mergeResult?.status??'')));
      if(!merged)throw new OfficeError('MERGE_REQUIRED','Confirm and complete merge before editing the current version.',403);
      return {target,token:edits.issue(target)};
    }));
  });
  app.post('/api/edit-sessions/revoke',(req,res)=>{
    if(res.locals.principal!=='viewer')throw new OfficeError('VIEWER_REQUIRED','Review page required.',403);
    const {token}=z.object({token:z.string()}).parse(req.body);edits.revoke(token);res.json({revoked:true});
  });
  app.post('/api/content',async(req,res)=>{
    const input=z.object({target:targetSchema,action:z.enum(['execute','snapshot','inspect']),mode:z.enum(['read','write']).default('read'),code:z.string().max(200000).optional(),query:z.record(z.unknown()).optional()}).parse(req.body);
    if (res.locals.principal !== 'agent') throw new OfficeError('AGENT_ONLY','Content programs are accepted only through the MCP/agent channel.',403);
    res.json(await office.serial(async()=>{
      const {unit}=await office.resolveTarget(input.target as Target,input.mode);
      if(input.action==='execute'&&!input.code) throw new OfficeError('CODE_REQUIRED','code is required');
      return runContent({...input,query:input.query as unknown as ContentInspectionQuery,origin,credential:agentToken,kind:unit.kind});
    }));
  });
  app.post('/api/delivery',async(req,res)=>{
    const input=z.object({target:targetSchema,action:z.enum(['export','screenshot','pdf','lint']),output:z.string().optional(),baseSelection:z.object({tableId:z.string().min(1),viewId:z.string().min(1).optional()}).strict().optional(),selector:z.record(z.unknown()).optional(),pages:z.array(z.union([z.number(),z.string()])).optional()}).parse(req.body);
    res.json(await office.serial(async()=>{
      const {unit}=await office.resolveTarget(input.target);
      if(input.baseSelection&&(unit.kind!=='base'||input.action!=='export'))throw new OfficeError('INVALID_BASE_SELECTION','Base selection is only valid for Base export.');
      if(unit.kind==='base'&&input.action==='export'&&!input.baseSelection)throw new OfficeError('BASE_SELECTION_REQUIRED','Select a Base table and optional view.');
      const snapshot=await runContent({origin,credential:agentToken,target:input.target,kind:unit.kind,action:unit.kind==='base'&&input.action==='export'?'base-export':unit.kind==='sheet'&&input.action==='export'&&/\.xlsx$/i.test(input.output??'')?'sheet-export':'snapshot',baseSelection:input.baseSelection,mode:'read'}) as ComparisonSnapshot & {selection?:unknown;fieldIds?:string[];recordCount?:number};
      const data=snapshot.unitData;
      const renderUnit={unitType:unit.kind,unitData:data} as UniverRenderUnit;
      if(input.action==='lint')return visual.lint(renderUnit,input.pages);
      const output=input.output?await office.path(input.output,false):undefined;
      if(input.action==='screenshot'){
        const result=await visual.screenshot(renderUnit,input.selector as UnitScreenshotInput['target']);
        const images=[];
        for(let i=0;i<result.images.length;i++){
          const image=result.images[i]!;
          const path=output?output.replace(/\.png$/i,`${result.images.length>1?`-${i+1}`:''}.png`):undefined;
          if(path)await publish(path,image.bytes);
          images.push({...image,bytes:undefined,data:Buffer.from(image.bytes).toString('base64'),output:path});
        }
        return {...result,images,revision:snapshot.revision};
      }
      if(!output)throw new OfficeError('OUTPUT_REQUIRED','output is required.');
      return {...await (input.action==='pdf'?visual.pdf(renderUnit,output):exportOffice(unit.kind,data,output)),target:input.target,revision:snapshot.revision,...(snapshot.selection?{baseSelection:snapshot.selection,fieldIds:snapshot.fieldIds,recordCount:snapshot.recordCount}:{})};
    }));
  });
  app.post('/api/comparisons',async(req,res)=>{
    const input=z.object({target:targetSchema,leftWorktreeId:z.string().optional()}).parse(req.body);
    res.json(await office.serial(async()=>{
      const{file,unit}=await office.resolveTarget(input.target);
      if(input.target.branch!=='worktree')throw new OfficeError('DRAFT_REQUIRED','Select a draft to compare.');
      const read=async(target:Target)=>await runContent({origin,credential:agentToken,target,kind:unit.kind,action:'snapshot',mode:'read'}) as ComparisonSnapshot;
      const right=await read(input.target);
      const leftTarget:Target|null=input.leftWorktreeId?{...input.target,worktreeId:input.leftWorktreeId}:unit.worktreeId?null:{fileId:input.target.fileId,unitId:input.target.unitId,branch:'trunk'};
      if(input.leftWorktreeId===input.target.worktreeId)throw new OfficeError('SAME_COMPARISON_SOURCE','Choose a different draft to compare.');
      await comparisonHeads(office,{leftTarget,rightTarget:input.target});
      const left=leftTarget?await read(leftTarget):{unitData:emptyUnit(unit.kind,unit.unitId,unit.name).data,revision:0};
      const record=compare(unit.kind,input.target,leftTarget,left,right);
      file.catalog.put('comparison',record.comparisonId,record);
      return record;
    }));
  });
  app.get('/api/files/:fileId/comparisons/:comparisonId/freshness',async(req,res)=>{
    res.json(await office.serial(async()=>{
      const record=office.file(req.params.fileId).catalog.get<ComparisonRecord>('comparison',req.params.comparisonId);
      if(!record)throw new OfficeError('COMPARISON_NOT_FOUND','Comparison unavailable.',404);
      const heads=await comparisonHeads(office,record);
      return {heads,changed:heads.left!==record.left.revision||heads.right!==record.right.revision};
    }));
  });
  app.get('/api/files/:fileId/comparisons/:comparisonId/pages',(req,res)=>{
    const {offset,contextOffset}=z.object({offset:z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),contextOffset:z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0)}).strict().parse(req.query);
    const record=office.file(req.params.fileId).catalog.get<ComparisonRecord>('comparison',req.params.comparisonId);
    if(!record)throw new OfficeError('COMPARISON_NOT_FOUND','Comparison unavailable.',404);
    res.json(comparisonPages.query(record,offset,contextOffset));
  });
  app.get('/api/files/:fileId/comparisons/:comparisonId',(req,res)=>{
    const record=office.file(req.params.fileId).catalog.get<ComparisonRecord>('comparison',req.params.comparisonId);
    if(!record)throw new OfficeError('COMPARISON_NOT_FOUND','Comparison unavailable.',404);res.json(record);
  });
  app.get('/api/config',(_req,res)=>res.json({license:process.env.UNIVER_LICENSE ?? '',stage:'M0',host:'browser-diagnostic'}));
  if(options.extensionRouter)app.use(options.extensionRouter);
  const viewerRoot=fileURLToPath(new URL('../viewer',import.meta.url));
  app.use('/render-diagnostic',express.static(fileURLToPath(new URL('../render-page',import.meta.url))));
  app.use(express.static(viewerRoot));
  app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    res.status(error instanceof OfficeError?error.status:400).json({code:error instanceof OfficeError?error.code:'REQUEST_FAILED',message:error instanceof Error?error.message:String(error)});
  });
  const server=createServer(app);
  server.on('upgrade',(req,socket,head)=>{
    try{previews.attach(req);}catch{socket.destroy();return;}
    const url=new URL(req.url??'/',origin);
    const match=url.pathname.replace(/^\/edit\/[a-f0-9]{64}(?=\/files\/)/,'').match(/^\/files\/([^/]+)(\/universer-api\/.*)$/);
    if(!match || req.headers.host!==new URL(origin).host || (req.headers.origin&&req.headers.origin!==origin)) {socket.destroy();return;}
    try {const file=office.file(decodeURIComponent(match[1]!));req.url=match[2]+url.search;file.transport.handleUpgrade(req,socket,head);} catch {socket.destroy();}
  });
  let port=options.port ?? 9080;
  while(true) {
    try {await new Promise<void>((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',no);yes();});});break;}
    catch(error) {if((error as NodeJS.ErrnoException).code!=='EADDRINUSE'||port>9100) throw error;port++;}
  }
  const address=server.address(); if(!address||typeof address==='string')throw new Error('No server address');
  origin=`http://127.0.0.1:${address.port}`;
  return {origin,agentToken,launchUrl:`${origin}/launch?ticket=${launchToken}`,office,
    async createPreview(target:Target){await office.resolveTarget(target);return previews.issue(target,origin);},
    async close(){const closed=new Promise<void>(yes=>server.close(()=>yes()));await office.close();await visual.close();server.closeAllConnections();await closed;}};
  } catch(error) {
    await Promise.allSettled([office.close(),visual.close()]);
    throw error;
  }
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const runtime=await startServer({workspace:resolve(process.env.WORKBUDDY_OFFICE_WORKSPACE??'.data/workspace'),port:Number(process.env.PORT??9080)});
  await mkdir('.data',{recursive:true});
  await writeFile('.data/runtime.json',JSON.stringify({origin:runtime.origin,agentToken:runtime.agentToken,launchUrl:runtime.launchUrl}),{mode:0o600});
  process.stderr.write(`WorkBuddy Office: ${runtime.launchUrl}\n`);
  for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{void runtime.close().then(()=>process.exit(0));});
}
