import type {Target,UnitKind} from '../shared/contracts.js';

export interface DeliveryContext {
  target:Target;kind:UnitKind;name:string;
  tables?:{id:string;name:string;views:{id:string;name:string}[]}[];
}
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const dialog=get<HTMLDialogElement>('delivery-dialog');
const form=get<HTMLFormElement>('delivery-form');
const format=get<HTMLSelectElement>('delivery-format');
const path=get<HTMLInputElement>('delivery-path');
const table=get<HTMLSelectElement>('delivery-table');
const view=get<HTMLSelectElement>('delivery-view');
const submit=get<HTMLButtonElement>('delivery-submit');
const cancel=get<HTMLButtonElement>('delivery-cancel');
const result=get<HTMLOutputElement>('delivery-result');
let selected:DeliveryContext|undefined,pending=false;
const formats:Record<UnitKind,string[]>={sheet:['xlsx','csv','tsv','pdf'],doc:['docx','pdf'],slide:['pptx','pdf'],base:['xlsx','csv','tsv'],board:['pdf']};
function views(){
  const chosen=selected?.tables?.find(item=>item.id===table.value);
  view.replaceChildren(new Option('整张表：全部字段与记录',''),...(chosen?.views??[]).map(item=>new Option(item.name,item.id)));
  view.disabled=!chosen;
}
export function openDelivery(context:DeliveryContext){
  if(pending)return;
  selected=context;
  get('delivery-title').textContent=context.target.branch==='worktree'?'导出草稿':'导出当前版本';
  get('delivery-source').textContent=`${context.name} · ${context.target.branch==='worktree'?'导出已确认的草稿内容，不会合入当前版本':'导出已确认内容'}`;
  format.replaceChildren(...formats[context.kind].map(extension=>new Option(extension.toUpperCase(),extension)));
  const name=context.name.replace(/[\\/:*?"<>|]/g,'-').slice(0,80)||'Office';
  path.value=`${name}-${Date.now()}.${format.value}`;
  const isBase=context.kind==='base';
  get('delivery-base').hidden=!isBase;table.required=isBase;
  table.replaceChildren(new Option('请选择要导出的表',''),...(context.tables??[]).map(item=>new Option(item.name,item.id)));
  views();result.textContent='';result.hidden=true;
  dialog.showModal();
}
table.onchange=views;
format.onchange=()=>{path.value=path.value.replace(/\.[^./\\]+$/,'')+`.${format.value}`;};
cancel.onclick=()=>dialog.close();
dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
form.onsubmit=event=>{
  event.preventDefault();
  if(pending||!selected)return;
  const context=selected;
  const baseSelection=context.kind==='base'?{tableId:table.value,...(view.value?{viewId:view.value}:{})}:undefined;
  const output=path.value.trim();
  if(!output.toLowerCase().endsWith(`.${format.value}`)){
    result.hidden=false;result.textContent=`保存路径必须以 .${format.value} 结尾。`;return;
  }
  pending=true;submit.disabled=true;cancel.disabled=true;
  format.disabled=true;path.disabled=true;table.disabled=true;view.disabled=true;
  result.hidden=false;result.textContent='正在生成文件…';
  void(async()=>{
    const response=await fetch('/api/delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:context.target,action:format.value==='pdf'?'pdf':'export',output,baseSelection})});
    const body=await response.json();
    if(!response.ok)throw new Error(body.code==='OUTPUT_EXISTS'?'该文件已存在，请换一个文件名。':body.message??'导出失败');
    result.textContent=`已保存\n${body.output}\n确认版本：${body.revision}${body.recordCount===undefined?'':` · ${body.recordCount} 条记录`}${body.pageCount===undefined?'':` · ${body.pageCount} 页`}`;
  })().catch(error=>{result.textContent=`导出失败：${error instanceof Error?error.message:String(error)}`;}).finally(()=>{
    pending=false;submit.disabled=false;cancel.disabled=false;
    format.disabled=false;path.disabled=false;table.disabled=false;view.disabled=!table.value;
  });
};
