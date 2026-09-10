import {randomBytes} from 'node:crypto';
import type {Target} from './contracts.js';

export type EditorPrincipal=`editor:${string}`;
/** Per-page grants, issued only by an authenticated confirmation in the review UI. */
export class EditSessions {
  private grants=new Map<string,Target>();
  issue(target:Target){const token=randomBytes(32).toString('hex');this.grants.set(token,{...target});return token;}
  revoke(token:string){this.grants.delete(token);}
  principal(token:string):EditorPrincipal|undefined{return this.grants.has(token)?`editor:${token}`:undefined;}
  allows(principal:string,fileId:string,worktreeId:string,unitId:string){
    const target=principal.startsWith('editor:')?this.grants.get(principal.slice(7)):undefined;
    return Boolean(target&&target.fileId===fileId&&target.branch==='trunk'&&!target.worktreeId&&worktreeId==='trunk'&&target.unitId===unitId);
  }
}
