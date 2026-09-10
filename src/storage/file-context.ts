import { SQLiteDatabaseAdapter } from '@univerjs-pro/collaboration-database-sqlite';
import { MemorySessionTicketStore, UniverCollabEndpoint } from '@univerjs-pro/collaboration-endpoint';
import { CollabError, UniverCollabService } from '@univerjs-pro/collaboration-service';
import { createNodeTransport } from '@univerjs-pro/collaboration-transport-node';
import { SQLiteWorktreeDatabaseAdapter } from '@univerjs-pro/collaboration-worktree-database-sqlite';
import { UniverCollabWorktreeEndpoint } from '@univerjs-pro/collaboration-worktree-endpoint';
import { UniverCollabWorktreeService } from '@univerjs-pro/collaboration-worktree-service';
import { SQLiteHistoryDatabaseAdapter } from '@univerjs-pro/collaboration-history-database-sqlite';
import { UniverHistoryService } from '@univerjs-pro/collaboration-history-service';
import { UniverHistoryEndpoint } from '@univerjs-pro/collaboration-history-endpoint';
import type { IncomingMessage } from 'node:http';
import { Catalog } from './catalog.js';
import {previewScope,type PreviewPrincipal} from '../shared/preview-principal.js';

import type {EditSessions,EditorPrincipal} from '../shared/edit-sessions.js';

export type Principal = 'agent' | 'viewer' | 'application' | PreviewPrincipal | EditorPrincipal;
export class FileContext {
  readonly database;
  readonly worktreeDatabase;
  readonly historyDatabase;
  readonly service;
  readonly worktrees;
  readonly history;
  readonly tickets = new MemorySessionTicketStore();
  readonly transport = createNodeTransport();
  readonly historySubscription;
  constructor(readonly catalog: Catalog, authenticate: (request: IncomingMessage) => Principal | undefined, edits?:EditSessions) {
    const options = { filename: catalog.filename, busyTimeoutMs: 5000 };
    this.database = new SQLiteDatabaseAdapter(options);
    this.worktreeDatabase = new SQLiteWorktreeDatabaseAdapter(options);
    this.historyDatabase = new SQLiteHistoryDatabaseAdapter(options);
    this.service = new UniverCollabService({ dbAdapter: this.database });
    this.worktrees = new UniverCollabWorktreeService({ trunk: { service: this.service, dbAdapter: this.database }, dbAdapter: this.worktreeDatabase });
    const checkFile=()=>{try{catalog.assertAvailable();}catch{throw new CollabError('PERMISSION_DENIED','Office file is no longer available at its original location.');}};
    for(const action of ['readUnitData','submitChangeset','applyChangeset','commitChangeset','createUnit'] as const){
      this.service.use(action,async(_ctx:unknown,next:()=>Promise<void>)=>{checkFile();await next();});
    }
    for(const action of ['readUnitData','submitChangeset','applyChangeset','commitChangeset','createWorktreeUnit'] as const){
      this.worktrees.use(action,async(_ctx:unknown,next:()=>Promise<void>)=>{checkFile();await next();});
    }
    this.worktrees.use('submitChangeset',async(_ctx,next)=>{
      try{await next();}catch(error){
        // The SDK may report retry over the socket. Keep the cause visible to local diagnostics.
        const causes:string[]=[];let current:unknown=error;
        for(let depth=0;depth<4&&current instanceof Error;depth++){causes.push(`${current.name}: ${current.message}`);current=current.cause;}
        process.stderr.write(`Office changeset rejected: ${causes.join(' <- ')}\n`);throw error;
      }
    });
    this.history = new UniverHistoryService({ collabService: this.service, dbAdapter: this.historyDatabase });
    this.historySubscription = this.history.attach(this.service);
    const deny = () => { throw new CollabError('PERMISSION_DENIED', 'This action requires an application review operation.'); };
    this.service.use('readUnitData',async(ctx,next)=>{
      const scope=previewScope(ctx.userID);if(scope&&ctx.request.unitID!==scope.unitId)deny();await next();
    });
    this.worktrees.use('readUnitData',async(ctx,next)=>{
      const scope=previewScope(ctx.userID);
      if(scope&&(ctx.request.unitID!==scope.unitId||ctx.request.worktreeID!==scope.worktreeId))deny();await next();
    });
    this.worktrees.use('submitChangeset',async(ctx,next)=>{if(ctx.userID!=='agent'&&ctx.userID!=='application')deny();await next();});
    this.service.use('submitChangeset',async(ctx,next)=>{
      const unitId=ctx.request.changeset.unitID;
      const unit=catalog.units().find(unit=>unit.unitId===unitId&&!unit.removed&&!unit.worktreeId);
      if(ctx.userID!=='application'&&(!unit||!edits?.allows(ctx.userID,catalog.fileId,'trunk',unitId)))deny();
      await next();
    });
    // Browser and Agent cannot bypass reviewed application actions through SDK lifecycle endpoints.
    for (const action of ['createUnit', 'deleteUnits', 'recoverUnits'] as const) {
      this.service.use(action, async (ctx: {userID:string}, next:()=>Promise<void>) => { if (ctx.userID !== 'application') deny(); await next(); });
    }
    for (const action of ['createWorktree', 'addWorktreeUnit', 'createWorktreeUnit', 'markWorktreeReady', 'reopenWorktree', 'discardWorktree', 'mergeWorktree', 'setWorktreeUnitRemoved'] as const) {
      this.worktrees.use(action, async (ctx: {userID:string}, next:()=>Promise<void>) => { if (ctx.userID !== 'application') deny(); await next(); });
    }
    this.transport.use(async (ctx, next) => {
      const principal = authenticate(ctx.incomingMessage);
      if (!principal) { ctx.response.statusCode = 401; ctx.response.end('Authentication required'); return; }
      ctx.userID = principal;
      await next();
    });
    const endpoint = new UniverCollabEndpoint(this.service, { ticketStore: this.tickets });
    const worktreeEndpoint = new UniverCollabWorktreeEndpoint(this.worktrees, { ticketStore: this.tickets });
    endpoint.use('joinUnit',async(ctx,next)=>{
      const scope=previewScope(ctx.session.userID);if(scope&&(scope.branch!=='trunk'||ctx.unitID!==scope.unitId))deny();await next();
    });
    worktreeEndpoint.use('connect',async(ctx,next)=>{
      const scope=previewScope(ctx.session.userID);if(scope&&ctx.worktreeID!==scope.worktreeId)deny();await next();
    });
    worktreeEndpoint.use('joinUnit',async(ctx,next)=>{
      const scope=previewScope(ctx.session.userID);if(scope&&(ctx.worktreeID!==scope.worktreeId||ctx.unitID!==scope.unitId))deny();await next();
    });
    this.transport.register(new UniverHistoryEndpoint(this.history));
    this.transport.register(endpoint);
    this.transport.register(worktreeEndpoint);
  }
  async close() {
    await this.transport.dispose();
    this.historySubscription.dispose();
    await this.history.dispose();
    await this.worktrees.dispose();
    await this.service.dispose();
    await this.historyDatabase.dispose();
    await this.worktreeDatabase.dispose();
    await this.database.dispose();
    await this.tickets.dispose();
    this.catalog.close();
  }
}
