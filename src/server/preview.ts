import {randomBytes} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {OfficeError,type Target} from '../shared/contracts.js';

/** UI-only, read-only capabilities. Never returned in model-visible tool content. */
export class PreviewSessions {
  private sessions=new Map<string,{target:Target;expires:number;review?:'merged'|'discarded'}>();
  private requests=new WeakMap<IncomingMessage,Target>();
  private reviews=new WeakMap<IncomingMessage,'merged'|'discarded'>();
  issue(target:Target,origin:string,review?:'merged'|'discarded'){
    const now=Date.now();
    for(const[token,session]of this.sessions){
      if(session.expires<now)this.sessions.delete(token);
      else if(session.review===review&&JSON.stringify(session.target)===JSON.stringify(target))return this.url(origin,token,target);
    }
    const token=randomBytes(32).toString('hex');
    this.sessions.set(token,{target:{...target},expires:now+8*60*60*1000,review});
    return this.url(origin,token,target);
  }
  private url(origin:string,token:string,target:Target){
    const url=new URL(`/preview/${token}/`,origin);
    url.searchParams.set('file',target.fileId);url.searchParams.set('unit',target.unitId);
    if(target.branch==='worktree'&&target.worktreeId)url.searchParams.set('worktree',target.worktreeId);
    return url.href;
  }
  scope(req:IncomingMessage){return this.requests.get(req);}
  review(req:IncomingMessage){return this.reviews.get(req);}
  attach(req:IncomingMessage){
    if(!req.url?.startsWith('/preview/'))return;
    const match=req.url.match(/^\/preview\/([a-f0-9]{64})(\/.*)$/);
    const session=match&&this.sessions.get(match[1]!);
    if(!session||session.expires<Date.now())throw new OfficeError('PREVIEW_EXPIRED','预览连接已失效，请刷新卡片。',401);
    req.url=match![2]!;
    this.requests.set(req,session.target);
    if(session.review)this.reviews.set(req,session.review);
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    const filePrefix=`/files/${encodeURIComponent(session.target.fileId)}/universer-api`;
    const branch=session.target.branch==='worktree'?`/worktrees/${encodeURIComponent(session.target.worktreeId!)}`:'';
    const allowed=path==='/'||path==='/index.html'||
      (req.method==='GET'&&['/api/config','/api/preview/resolve','/api/files',`/api/files/${session.target.fileId}`].includes(path))||
      (req.method==='POST'&&path===`/api/files/${session.target.fileId}/permissions/${session.target.worktreeId||'trunk'}/-/object/-/batch_allowed`)||
      path===`${filePrefix}/user/session-ticket`||
      path.startsWith(`${filePrefix}${branch}/snapshot/`)||path===`${filePrefix}${branch}/snapshot`||
      path.startsWith(`${filePrefix}${branch}/comb/`)||path===`${filePrefix}${branch}/comb`;
    if(!allowed)throw new OfficeError('PREVIEW_SCOPE','This preview only permits reading the selected content.',403);
  }
}
