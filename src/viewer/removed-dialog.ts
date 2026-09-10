import {viewerUrl} from './connection.js';
interface RemovedUnit {unitId:string;name:string;kind:string;fingerprint:string}
export async function openRemovedDialog(fileId:string,onRestored:(unitId:string)=>Promise<void>){
 if(document.querySelector('#removed-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='office-dialog';dialog.id='removed-dialog';dialog.setAttribute('aria-labelledby','removed-title');
 dialog.innerHTML='<h2 id="removed-title">已移除内容</h2><p>恢复会将保留的内容重新放回当前文件目录，内容和历史版本保持不变。</p><div data-list>正在加载…</div><p data-error role="alert"></p><div class="dialog-actions"><button type="button" data-close>关闭</button></div>';
 const list=dialog.querySelector<HTMLElement>('[data-list]')!,error=dialog.querySelector<HTMLElement>('[data-error]')!,close=dialog.querySelector<HTMLButtonElement>('[data-close]')!;
 let busy=false;
 const cleanup=()=>{if(!busy){dialog.close();dialog.remove();}};
 close.onclick=cleanup;dialog.addEventListener('cancel',event=>{event.preventDefault();cleanup();});
 document.body.append(dialog);dialog.showModal();
 try{
  const response=await fetch(viewerUrl(`/api/files/${fileId}/removed-units`),{signal:AbortSignal.timeout(10000)});
  const units=await response.json();if(!response.ok)throw new Error(units.message??'无法加载已移除内容');
  list.replaceChildren();if(!units.length)list.textContent='没有可恢复的已移除内容。';
  for(const unit of units as RemovedUnit[]){
   const row=document.createElement('div'),name=document.createElement('span'),restore=document.createElement('button');
   row.className='removed-unit-row';name.textContent=`${unit.name} · ${unit.kind.toUpperCase()}`;restore.textContent=`恢复 ${unit.name}`;
   restore.onclick=()=>void(async()=>{
    if(busy)return;busy=true;error.textContent='';for(const button of dialog.querySelectorAll('button'))button.disabled=true;
    try{
     const response=await fetch(viewerUrl(`/api/files/${fileId}/removed-units/${unit.unitId}/restore`),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fingerprint:unit.fingerprint}),signal:AbortSignal.timeout(30000)});
     const result=await response.json();if(!response.ok)throw new Error(result.message??'恢复失败');
     await onRestored(unit.unitId);busy=false;cleanup();
    }catch(e){error.textContent=e instanceof Error?e.message:String(e);}
    finally{busy=false;for(const button of dialog.querySelectorAll('button'))button.disabled=false;}
   })();
   row.append(name,restore);list.append(row);
  }
 }catch(e){list.textContent='加载未完成，请关闭后重试。';error.textContent=e instanceof Error?e.message:String(e);}
}
