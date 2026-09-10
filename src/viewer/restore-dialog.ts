import {viewerUrl} from './connection.js';
interface Version {id:string;revision:number;createdAt:string}
interface Prepared {operationId:string;unitName:string;targetRevision:number;expectedRevision:number}
class RestoreError extends Error {constructor(message:string,readonly code:string){super(message);}}
async function post<T>(fileId:string,token:string,action:string,body:unknown):Promise<T>{
 const response=await fetch(viewerUrl(`/api/files/${encodeURIComponent(fileId)}/history/${action}?editSession=${encodeURIComponent(token)}`),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const value=await response.json();if(!response.ok)throw new RestoreError(value.message??'请求失败',value.code??'REQUEST_FAILED');return value;
}
export function openRestoreDialog(fileId:string,unitId:string,token:string,onRestored:(revision:number)=>Promise<void>,runRestore:(operation:()=>Promise<{revision:number}>)=>Promise<{revision:number}>){
 if(document.querySelector('#restore-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='office-dialog';dialog.id='restore-dialog';
 dialog.innerHTML='<h2>恢复历史版本</h2><p class="restore-description">先在“历史版本”中查看内容，再选择要恢复的版本。恢复将生成新的当前版本，原有历史仍会保留。</p><label>历史版本<select aria-label="选择恢复版本"><option value="">请选择历史版本</option></select></label><button type="button" data-more hidden>加载更早版本</button><p data-summary role="status">正在加载版本…</p><p data-error role="alert"></p><div class="dialog-actions"><button type="button" data-close>取消</button><button type="button" data-submit disabled>确认所选版本</button></div>';
 const select=dialog.querySelector('select')!,summary=dialog.querySelector<HTMLElement>('[data-summary]')!,error=dialog.querySelector<HTMLElement>('[data-error]')!,submit=dialog.querySelector<HTMLButtonElement>('[data-submit]')!,close=dialog.querySelector<HTMLButtonElement>('[data-close]')!,more=dialog.querySelector<HTMLButtonElement>('[data-more]')!;
 let prepared:Prepared|undefined,inflight=false,lastLabel:string|undefined,completedRevision:number|undefined;
 const versions:Version[]=[];
 const lock=(value:boolean)=>{inflight=value;select.disabled=value||Boolean(prepared);submit.disabled=value||!select.value||Boolean(select.selectedOptions[0]?.disabled);close.disabled=value;more.disabled=value||Boolean(prepared);};
 const cleanup=()=>{if(!inflight){dialog.close();dialog.remove();}};
 const cancel=async()=>{
  if(inflight)return;
  lock(true);error.textContent='';
  try{
   if(prepared&&completedRevision===undefined)await post(fileId,token,'cancel',{operationId:prepared.operationId});
   lock(false);cleanup();
  }catch(e){error.textContent=e instanceof Error?e.message:String(e);}
  finally{lock(false);}
 };
 close.onclick=()=>void cancel();dialog.addEventListener('cancel',event=>{event.preventDefault();void cancel();});dialog.addEventListener('close',()=>dialog.remove());
 select.onchange=()=>{prepared=undefined;error.textContent='';summary.textContent='确认前会核验当前版本。';submit.textContent='确认所选版本';lock(false);};
 const load=async()=>{
  lock(true);error.textContent='';
  try{
   const page=await post<{unitName:string;currentRevision:number;versions:Version[];hasMore:boolean;lastLabel:string}>(fileId,token,'list',{unitId,lastLabel});
   for(const version of page.versions)if(!versions.some(v=>v.id===version.id)){versions.push(version);const option=document.createElement('option');option.value=String(version.revision);option.textContent=`版本 ${version.revision} · ${new Date(Number(version.createdAt)).toLocaleString()}`;select.append(option);}
   for(const option of Array.from(select.options))if(option.value){
    const revision=Number(option.value),version=versions.find(v=>v.revision===revision)!;
    option.disabled=revision>=page.currentRevision;
    option.textContent=`版本 ${revision}${revision===page.currentRevision?'（当前版本）':''} · ${new Date(Number(version.createdAt)).toLocaleString()}`;
   }
   if(select.selectedOptions[0]?.disabled)select.value='';
   const available=versions.some(v=>v.revision<page.currentRevision);
   select.options[0].textContent=available?'请选择历史版本':page.hasMore?'请加载更早版本':'暂无可恢复的历史版本';
   lastLabel=page.lastLabel;more.hidden=!page.hasMore;more.textContent='加载更早版本';
   summary.textContent=available?`内容：${page.unitName}，当前版本 ${page.currentRevision}。请选择先前查看过的历史版本。`:page.hasMore?'当前列表没有可恢复版本，请加载更早版本。':'当前内容尚无可恢复的历史版本。';
  }catch(e){error.textContent=String(e);more.hidden=false;more.textContent='重试加载';}finally{lock(false);}
 };
 more.onclick=()=>void load();
 submit.onclick=()=>void(async()=>{
  lock(true);error.textContent='';
  try{
   if(completedRevision!==undefined){await onRestored(completedRevision);lock(false);cleanup();return;}
   if(!prepared){
    prepared=await post<Prepared>(fileId,token,'prepare',{unitId,revision:Number(select.value)});
    summary.textContent=`将“${prepared.unitName}”从当前版本 ${prepared.expectedRevision} 恢复到历史版本 ${prepared.targetRevision} 的内容，并生成新版本。`;
    submit.textContent='恢复并生成新版本';close.textContent='取消恢复';return;
   }
   const operationId=prepared.operationId;
   const result=await runRestore(()=>post<{revision:number}>(fileId,token,'confirm',{operationId}));completedRevision=result.revision;
   await onRestored(result.revision);lock(false);cleanup();
  }catch(e){
   error.textContent=e instanceof Error?e.message:String(e);
   if(e instanceof RestoreError&&['STALE_REVIEW','RESTORE_EXPIRED','RESTORE_NOT_FOUND','RESTORE_CANCELLED'].includes(e.code)){prepared=undefined;submit.textContent='重新核验所选版本';}
   else submit.textContent=completedRevision!==undefined?'恢复已完成，重试显示':prepared?'重试同一恢复操作':'重试确认';
  }finally{lock(false);}
 })();
 document.body.append(dialog);dialog.showModal();void load();
}
