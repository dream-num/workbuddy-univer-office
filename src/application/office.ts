import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DocumentFlavor,LocaleType,UniverInstanceType,createParagraphId,createSectionId } from '@univerjs/core';
import { UniverType } from '@univerjs/protocol';
import { getSlidesEmptySnapshot } from '@univerjs-pro/slides';
import {getBoardsEmptySnapshot} from '@univerjs-pro/boards';
import {importFile} from '@univerjs-pro/exchange-node';
import type { WorktreeData } from '@univerjs-pro/collaboration-worktree-service';
import type { CreateUnitFromDataInput } from '@univerjs-pro/collaboration-service';
import { Catalog } from '../storage/catalog.js';
import { FileContext, type Principal } from '../storage/file-context.js';
import { OfficeError, requireValue, type Target, type UnitKind, type UnitRecord } from '../shared/contracts.js';
import type {EditSessions} from '../shared/edit-sessions.js';
import type { IncomingMessage } from 'node:http';

const context = { userID: 'application' };
export const protocolTypes = { sheet: UniverType.UNIVER_SHEET, doc: UniverType.UNIVER_DOC, slide: UniverType.UNIVER_SLIDE,
  base: UniverType.UNIVER_BASE, board: UniverType.UNIVER_BOARD };

export class Office {
  readonly files = new Map<string, FileContext>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly workspace: string, private authenticate: (req: IncomingMessage) => Principal | undefined, private edits?:EditSessions) {}
  canEditTrunk(principal:Principal,fileId:string,unitId:string){
    return Boolean(this.edits?.allows(principal,fileId,'trunk',unitId));
  }
  requireTrunkEdit(principal:Principal,fileId:string,unitId:string){
    if(!this.canEditTrunk(principal,fileId,unitId))throw new OfficeError('EDIT_REQUIRED','Enable editing for this merged content before restoring history.',403);
  }
  serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn); this.queue = result.catch(() => undefined); return result;
  }
  async path(input: string, mustExist = true) {
    const target = resolve(this.workspace, input);
    const canonical = mustExist ? await realpath(target) : resolve(await realpath(dirname(target)), basename(target));
    const rel = relative(this.workspace, canonical);
    requireValue(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'OUTSIDE_WORKSPACE', 'Path must stay inside the configured workspace.');
    return canonical;
  }
  async init() {
    await mkdir(this.workspace, { recursive: true });
    for (const entry of await readdir(this.workspace, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.univer')) {
        // Unknown .univer formats are not modified or silently converted.
        try { await this.open(entry.name); } catch (error) { process.stderr.write(`${String(error)}\n`); }
      }
    }
  }
  async open(path: string, create = false) {
    const filename = await this.path(path, !create);
    requireValue(extname(filename) === '.univer', 'INVALID_EXTENSION', 'Office containers use .univer.');
    const existing = [...this.files.values()].find(f => f.catalog.filename === filename);
    if (existing) { requireValue(!create, 'FILE_EXISTS', 'File already exists.'); return existing; }
    const catalog = new Catalog(filename, create);
    if (this.files.has(catalog.fileId)) { catalog.close(); throw new OfficeError('DUPLICATE_FILE_ID', 'A different physical copy with this identity is already open.'); }
    const file = new FileContext(catalog, this.authenticate, this.edits);
    try {
      // Recover directory projections before any request can resolve this file.
      // SDK merge results survive a crash between content commit and catalog write.
      for (const {worktreeId} of catalog.list<{worktreeId:string}>('worktree')) {
        const {worktree}=await file.worktrees.getWorktree({worktreeID:worktreeId},context);
        this.reconcile(file,worktree);
      }
    } catch(error) {
      await file.close();throw error;
    }
    this.files.set(catalog.fileId, file);
    return file;
  }
  file(fileId: string) {
    const file = this.files.get(fileId);
    requireValue(file, 'FILE_NOT_FOUND', 'Office file is not open in this workspace.');
    file.catalog.assertAvailable();
    return file;
  }
  list() { return [...this.files.values()].map(f => ({ fileId: f.catalog.fileId, name: basename(f.catalog.filename) })); }
  async status(fileId: string) {
    const file = this.file(fileId);
    await this.path(file.catalog.filename);
    const worktrees: WorktreeData[] = [];
    for (const { worktreeId } of file.catalog.list<{worktreeId:string}>('worktree')) {
      const { worktree } = await file.worktrees.getWorktree({ worktreeID: worktreeId }, context);
      worktrees.push(worktree);
      this.reconcile(file, worktree);
    }
    return { fileId, name: basename(file.catalog.filename), units: file.catalog.units(), worktrees };
  }
  private reconcile(file: FileContext, worktree: WorktreeData) {
    for (const unit of worktree.units) {
      const record = file.catalog.get<UnitRecord>('unit', unit.unitID);
      if (!record || !unit.mergeResult) continue;
      if (['merged', 'unchanged'].includes(unit.mergeResult.status)) {
        file.catalog.put('unit', unit.unitID, { ...record, worktreeId: undefined });
      } else if (unit.mergeResult.status === 'removed') {
        const restored=file.catalog.get<{removalIds:string[]}>('directory-restore',unit.unitID);
        if(restored?.removalIds.includes(worktree.worktreeID))continue;
        file.catalog.put('unit', unit.unitID, { ...record, removed: true });
      }
    }
  }
  async removedUnits(fileId:string){
    const status=await this.status(fileId);
    return status.units.filter(unit=>unit.removed&&!unit.worktreeId).map(unit=>{
      const removalIds=status.worktrees.filter(w=>w.units.some(u=>u.unitID===unit.unitId&&u.mergeResult?.status==='removed')).map(w=>w.worktreeID).sort();
      return {...unit,removalIds,fingerprint:createHash('sha256').update(JSON.stringify({unit,removalIds})).digest('hex')};
    });
  }
  async restoreRemovedUnit(fileId:string,unitId:string,fingerprint:string,principal:Principal){
    if(principal!=='viewer')throw new OfficeError('VIEWER_REQUIRED','Directory recovery requires an authenticated review page.',403);
    const file=this.file(fileId),unit=file.catalog.get<UnitRecord>('unit',unitId);
    requireValue(unit&&!unit.worktreeId,'UNIT_NOT_FOUND','No retained trunk content is available.');
    const prior=file.catalog.get<{fingerprint:string}>('directory-restore',unitId);
    if(!unit.removed&&prior?.fingerprint===fingerprint)return {unitId,outcome:'restored' as const};
    const selected=(await this.removedUnits(fileId)).find(u=>u.unitId===unitId);
    requireValue(selected&&selected.fingerprint===fingerprint,'STALE_REVIEW','Removal state changed. Review the removed contents again.');
    await file.service.getUnitLoadData({unitID:unitId,type:protocolTypes[unit.kind],revision:0},context);
    // Application metadata only: acknowledgement and visibility commit together.
    file.catalog.db.transaction(()=>{
      file.catalog.put('directory-restore',unitId,{unitId,fingerprint,removalIds:selected.removalIds,actor:principal,restoredAt:new Date().toISOString()});
      file.catalog.put('unit',unitId,{...unit,removed:false});
    })();
    return {unitId,outcome:'restored' as const};
  }
  async createWorktree(fileId: string, unitIds: string[] = []) {
    const file = this.file(fileId), worktreeId = randomUUID();
    for (const unitId of unitIds) {const unit=file.catalog.get<UnitRecord>('unit', unitId);requireValue(unit&&!unit.removed&&!unit.worktreeId, 'UNIT_NOT_FOUND', 'Unit is not available on trunk.');}
    file.catalog.put('worktree', worktreeId, { worktreeId, createdAt: new Date().toISOString() });
    let result;
    try{result = await file.worktrees.createWorktree({ worktreeID: worktreeId, units: unitIds }, context);}
    catch(error){file.catalog.remove('worktree',worktreeId);throw error;}
    return result.worktree;
  }
  async createUnit(fileId: string, worktreeId: string, kind: UnitKind, name: string) {
    const file = this.file(fileId), unitId = randomUUID();
    const state=await file.worktrees.getWorktree({worktreeID:worktreeId},context);
    requireValue(state.worktree.status==='draft','WORKTREE_FROZEN','Reopen before creating content.');
    const input = emptyUnit(kind, unitId, name);
    const record: UnitRecord = { unitId, kind, name, worktreeId };
    file.catalog.put('unit', unitId, record);
    try{await file.worktrees.createUnitFromData({ ...input, worktreeID: worktreeId }, context);}
    catch(error){file.catalog.remove('unit',unitId);throw error;}
    return record;
  }
  async setUnitRemoved(fileId:string,worktreeId:string,unitId:string,removed:boolean){
    const file=this.file(fileId);await this.path(file.catalog.filename);
    const unit=file.catalog.get<UnitRecord>('unit',unitId);
    requireValue(unit&&!unit.removed,'UNIT_NOT_FOUND','Unit unavailable.');
    const {worktree}=await file.worktrees.getWorktree({worktreeID:worktreeId},context);
    requireValue(worktree.status==='draft','WORKTREE_FROZEN','Reopen before changing removal intent.');
    requireValue(worktree.units.some(u=>u.unitID===unitId),'UNIT_NOT_IN_WORKTREE','Unit is not present in this worktree.');
    return file.worktrees.setUnitRemoved({worktreeID:worktreeId,unitID:unitId,removed},context);
  }
  async importUnit(fileId:string,worktreeId:string,source:string,name?:string){
    const path=await this.path(source),extension=extname(path).toLowerCase(),unitId=randomUUID();
    let kind:UnitKind,input:CreateUnitFromDataInput;
    if(['.xlsx','.csv','.tsv'].includes(extension)){kind='sheet';input={type:UniverType.UNIVER_SHEET,data:await importFile(path,{type:UniverInstanceType.UNIVER_SHEET,unitId})};}
    else if(extension==='.docx'){kind='doc';input={type:UniverType.UNIVER_DOC,data:await importFile(path,{type:UniverInstanceType.UNIVER_DOC,unitId})};}
    else if(extension==='.pptx'){kind='slide';input={type:UniverType.UNIVER_SLIDE,data:await importFile(path,{type:UniverInstanceType.UNIVER_SLIDE,unitId})};}
    else throw new OfficeError('UNSUPPORTED_IMPORT','Supported inputs: XLSX, CSV, TSV, DOCX, PPTX.');
    const file=this.file(fileId),record:UnitRecord={unitId,kind,name:name??basename(path),worktreeId};
    file.catalog.put('unit',unitId,record);
    try{await file.worktrees.createUnitFromData({...input,worktreeID:worktreeId},context);}
    catch(error){file.catalog.remove('unit',unitId);throw error;}
    return record;
  }
  async resolveTarget(target: Target, mode: 'read' | 'write' = 'read') {
    const file = this.file(target.fileId);
    await this.path(file.catalog.filename);
    const unit = file.catalog.get<UnitRecord>('unit', target.unitId);
    requireValue(unit && !unit.removed, 'UNIT_NOT_FOUND', 'Unit unavailable.');
    if (target.branch === 'trunk') {
      requireValue(!target.worktreeId && !unit.worktreeId, 'INVALID_TARGET', 'This Unit is not on trunk.');
      requireValue(mode === 'read', 'TRUNK_WRITE_DENIED', 'Agent writes require an editable worktree.');
    } else {
      requireValue(target.worktreeId, 'INVALID_TARGET', 'worktreeId is required.');
      const {worktree} = await file.worktrees.getWorktree({worktreeID:target.worktreeId}, context);
      const selected = worktree.units.find(u => u.unitID === unit.unitId);
      requireValue(selected && !selected.removed, 'UNIT_NOT_IN_WORKTREE', 'Unit is not present in this worktree.');
      if (mode === 'write') requireValue(worktree.status === 'draft', 'WORKTREE_FROZEN', 'Reopen the worktree before editing.');
    }
    return {file, unit};
  }
  async reviewState(fileId: string, worktreeId: string) {
    const file = this.file(fileId);
    const {worktree} = await file.worktrees.getWorktree({worktreeID:worktreeId}, context);
    const heads = [];
    for (const unit of worktree.units.filter(u => u.source === 'trunk')) {
      const head = await file.service.getUnitLoadData({unitID: unit.unitID,type:unit.type,revision:0},context);
      heads.push([unit.unitID, head.targetRevision]);
    }
    const fingerprint = createHash('sha256').update(JSON.stringify({ worktree, heads, units:file.catalog.units() })).digest('hex');
    return { worktree, fingerprint };
  }
  async action(fileId: string, worktreeId: string, action: 'ready'|'reopen'|'merge'|'discard', principal: Principal, fingerprint?: string) {
    const file = this.file(fileId), input = {worktreeID: worktreeId};
    if (action === 'merge' || action === 'discard') {
      if (principal !== 'viewer') return { outcome:'pending-review', fileId, worktreeId };
      const current = await this.reviewState(fileId, worktreeId);
      requireValue(fingerprint === current.fingerprint, 'STALE_REVIEW', 'Content changed. Refresh and review again.');
    }
    const operationId = randomUUID();
    file.catalog.put('operation', operationId, { operationId, action, worktreeId, status:'intent', fingerprint });
    const result = action === 'ready' ? await file.worktrees.markReady(input, context)
      : action === 'reopen' ? await file.worktrees.reopenWorktree(input, context)
      : action === 'discard' ? await file.worktrees.discardWorktree(input, context)
      : await file.worktrees.mergeWorktree(input, { ...context, memberID: `review:${operationId}` });
    this.reconcile(file, result.worktree);
    const outcome = action === 'merge' && result.worktree.status !== 'merged' ? 'partial' : 'completed';
    file.catalog.put('operation', operationId, {operationId,action,worktreeId,status:'result',outcome,result});
    return {operationId,outcome,...result};
  }
  async close() { await this.queue; for (const file of this.files.values()) await file.close(); this.files.clear(); }
}

export function emptyUnit(kind: UnitKind, id: string, name: string): CreateUnitFromDataInput {
  if (kind === 'sheet') return { type: UniverType.UNIVER_SHEET, data: { id, name, rev:1, appVersion:'1.0.0',locale:LocaleType.ZH_CN,
    sheetOrder:['data'], sheets:{data:{id:'data',name:'数据',rowCount:200,columnCount:26,cellData:{}}},styles:{},resources:[] } };
  if (kind === 'doc') return { type: UniverType.UNIVER_DOC, data:{id,rev:1,title:name,locale:LocaleType.ZH_CN,body:{dataStream:'\r\n',paragraphs:[{paragraphId:createParagraphId(new Set()),startIndex:0}],sectionBreaks:[{sectionId:createSectionId(new Set()),startIndex:1}],textRuns:[]},documentStyle:{documentFlavor:DocumentFlavor.TRADITIONAL},resources:[]} };
  if (kind === 'slide') return { type: UniverType.UNIVER_SLIDE, data: {...getSlidesEmptySnapshot(id,LocaleType.ZH_CN,name),rev:1} };
  if(kind==='base')return {type:UniverType.UNIVER_BASE,data:{id,name,rev:1,schemaVersion:1,tables:{},tableOrder:[],createdAt:Date.now(),updatedAt:Date.now(),locale:LocaleType.ZH_CN,resources:[]}};
  if(kind==='board')return {type:UniverType.UNIVER_BOARD,data:{...getBoardsEmptySnapshot(id,name,LocaleType.ZH_CN),rev:1}};
  throw new OfficeError('CAPABILITY_PENDING', `${kind} creation is awaiting installed SDK contract verification.`);
}
