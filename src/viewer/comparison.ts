import type {ComparisonRecord} from "../application/comparison.js";
import type {IUnitComparisonItem} from "@univerjs-pro/edit-history";
import type {IWorkbookData} from '@univerjs/core';
import {scopeKey, sheetComparisonSnapshot, visibleComparisonItems, type SheetCompareMode} from '../shared/comparison-presentation.js';
import {setToolbarIcon} from './toolbar-icons.js';
import {comparisonChangeLines,comparisonItemCaption} from '../shared/comparison-description.js';
interface ComparisonPreferences {mode:SheetCompareMode;showFormulas:boolean;scope:string;search:string;activeScope:string}
interface ComparisonControls {sources:{id:string;name:string}[];preferences?:ComparisonPreferences;onSourceChange:(id:string)=>Promise<void>;onRefresh:()=>Promise<void>}
export function mountComparison(host:HTMLElement,record:ComparisonRecord,license:string,controls:ComparisonControls){
  host.className='comparison';host.replaceChildren();
  const toolbar=document.createElement('div');toolbar.className='comparison-toolbar';
  const label=document.createElement('label');label.textContent='对比基准';
  const source=document.createElement('select');source.setAttribute('aria-label','对比基准');
  source.append(new Option('已保存内容',''),...controls.sources.map(item=>new Option(item.name,item.id)));
  source.value=record.leftTarget?.worktreeId??'';label.append(source);
  const freshness=document.createElement('span');freshness.className='comparison-freshness';freshness.role='status';freshness.textContent='固定版本';
  const refresh=document.createElement('button');setToolbarIcon(refresh,'refresh','刷新对比');
  const run=async(action:()=>Promise<void>)=>{
    source.disabled=true;refresh.disabled=true;
    try{await action();}catch(error){freshness.textContent=`刷新失败：${String(error)}`;source.value=record.leftTarget?.worktreeId??'';}
    finally{source.disabled=false;refresh.disabled=false;}
  };
  source.onchange=()=>void run(()=>controls.onSourceChange(source.value));refresh.onclick=()=>void run(controls.onRefresh);
  const sourceControls=document.createElement('div');sourceControls.className='comparison-source-controls';sourceControls.append(label,freshness,refresh);
  const displayControls=document.createElement('div');displayControls.className='comparison-display-controls';
  toolbar.append(sourceControls,displayControls);host.append(toolbar);
  let mode:SheetCompareMode=controls.preferences?.mode??'content',showFormulas=controls.preferences?.showFormulas??false,activeScope=controls.preferences?.activeScope??'';
  if(!activeScope&&(record.kind==='slide'||record.kind==='base'))activeScope=scopeKey(record.result.scopes[0]);
  const scope=document.createElement('select');scope.setAttribute('aria-label','变更范围');
  const currentName=record.kind==='slide'?'当前页面':record.kind==='base'?'当前数据表':'当前工作表';
  scope.append(new Option('全部变更',''),new Option(currentName,'active'),...record.result.scopes.map(item=>new Option(item.displayName,scopeKey(item))));
  if(record.kind==='slide'||record.kind==='base')scope.value='active';
  if(controls.preferences&&Array.from(scope.options).some(option=>option.value===controls.preferences!.scope))scope.value=controls.preferences.scope;
  if(['sheet','slide','base'].includes(record.kind))displayControls.append(scope);
  const search=document.createElement('input');search.type='search';search.placeholder='搜索变更';search.setAttribute('aria-label','搜索变更');
  search.value=controls.preferences?.search??'';
  if(record.kind==='sheet'){
    const modes=document.createElement('div');modes.className='comparison-modes';modes.role='group';modes.setAttribute('aria-label','对比显示');
    for(const [value,text] of [['content','内容'],['formatting','格式']] as const){
      const button=document.createElement('button');button.textContent=text;button.setAttribute('aria-pressed',String(mode===value));
      button.onclick=()=>{if(mode===value)return;mode=value;for(const b of modes.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));renderList();loadPanes();};modes.append(button);
    }
    const formula=document.createElement('button');formula.className='comparison-formulas';formula.textContent='显示公式';formula.setAttribute('aria-pressed',String(showFormulas));
    formula.onclick=()=>{showFormulas=!showFormulas;formula.setAttribute('aria-pressed',String(showFormulas));loadPanes();};
    displayControls.append(modes,formula);
  }
  const editors:HTMLIFrameElement[]=[];
  const ready=new Set<number>();let requestId=0;
  const replies=new Map<number,string>();
  const layout=document.createElement('div');layout.className='comparison-editors';host.append(layout);
  const visibleItems=()=>visibleComparisonItems(record.result.items,{sheetMode:record.kind==='sheet'?mode:undefined,scope:scope.value==='active'?activeScope:scope.value,search:search.value});
  const marksFor=(side:'left'|'right')=>visibleItems().map(item=>({id:item.id,kind:item.kind,target:item.locations[side]?.target}));
  function updateMarks(){for(const [index,side] of (['left','right'] as const).entries())editors[index]?.contentWindow?.postMessage({type:'office-marks',marks:marksFor(side)},location.origin);}
  function loadPanes(){
    // Each display change gets new iframe windows. Late messages from disposed panes cannot win.
    ready.clear();buttons.forEach(button=>button.disabled=true);navigation.textContent='正在加载两个固定版本…';
    for(const editor of editors)editor.remove();editors.length=0;layout.replaceChildren();
    for(const side of ['left','right'] as const){
      const pane=document.createElement('section');const heading=document.createElement('div');heading.className='comparison-heading';
      heading.textContent=`${side==='left'?(record.leftTarget?.worktreeId?'另一草稿':'当前版本'):'本次草稿'} · 固定版本 ${record[side].revision}`;
      const container=document.createElement('iframe');container.title=heading.textContent;container.className='comparison-editor';container.style.cssText='width:100%;border:0';
      const unitData=record.kind==='sheet'&&record[side].unitData?sheetComparisonSnapshot(record[side].unitData as IWorkbookData,mode):record[side].unitData;
      container.onload=()=>container.contentWindow?.postMessage({type:'office-snapshot',kind:record.kind,unitData,license,showFormulas,darkMode:document.body.classList.contains('dark'),marks:marksFor(side)},location.origin);
      container.src='/snapshot.html';pane.append(heading,container);layout.append(pane);editors.push(container);
    }
  }
  const changes=document.createElement('aside');changes.className='comparison-changes';changes.setAttribute('aria-label','变更列表');host.prepend(changes);
  const title=document.createElement('strong');changes.append(title,search);
  const list=document.createElement('div');list.className='comparison-tree';
  {const legend=document.createElement('p');legend.className='comparison-legend';legend.innerHTML='<span class=insert>绿色：新增</span><span class=delete>红色：删除</span><span class=update>黄色：修改</span><span>正文标记当前可见变化</span>';changes.append(legend);}
  const navigation=document.createElement('p');navigation.role='status';navigation.className='comparison-navigation';navigation.textContent='正在加载两个固定版本…';changes.append(navigation);
  const buttons:HTMLButtonElement[]=[];
  changes.append(list);
  scope.onchange=()=>{if(scope.value&&scope.value!=='active')activeScope=scope.value;renderList();updateMarks();const selected=record.result.scopes.find(item=>scopeKey(item)===(scope.value==='active'?activeScope:scope.value));if(selected&&ready.size===2){replies.clear();navigate(selected,editors,++requestId);}};
  search.oninput=()=>{renderList();updateMarks();};
  const receive=(event:MessageEvent)=>{
    if(event.origin!==location.origin)return;
    const side=editors.findIndex(editor=>editor.contentWindow===event.source);if(side<0)return;
    if(event.data?.type==='office-snapshot-ready'){
      if(!activeScope&&event.data.scope?.stableId)activeScope=scopeKey(event.data.scope);
      ready.add(side);if(ready.size===2){buttons.forEach(button=>button.disabled=false);navigation.textContent='颜色标记当前可见变化；点击条目定位对应内容';const selected=record.result.scopes.find(item=>scopeKey(item)===(scope.value==='active'?activeScope:scope.value));if(selected)navigate(selected,editors,++requestId);}
    }else if(event.data?.type==='office-scope-changed'){
      const next=scopeKey(event.data.scope);if(!event.data.scope?.stableId||next===activeScope||ready.size!==2)return;
      activeScope=next;if(scope.value){scope.value='active';renderList();updateMarks();}
      const selected=record.result.scopes.find(item=>scopeKey(item)===next);
      if(selected){replies.clear();navigate(selected,editors,++requestId);}
    }else if(event.data?.type==='office-snapshot-error'){navigation.textContent=`${side===0?'左侧':'右侧'}加载失败：${event.data.detail}`;}
    else if(event.data?.type==='office-navigation-result'&&event.data.requestId===requestId){
      replies.set(side,String(event.data.detail));navigation.textContent=[0,1].map(index=>`${index===0?'左侧':'右侧'}：${replies.get(index)??'正在定位…'}`).join('；');
    }
  };
  window.addEventListener('message',receive);
  const itemNumbers=new Map(record.result.items.map((item,index)=>[item.id,index+1]));
  function renderList(){
    list.replaceChildren();buttons.length=0;
    const visible=visibleItems();title.textContent=`变更 · ${visible.length} / ${record.result.items.length} 项`;
    const groups=new Map<string,HTMLElement>();
    for(const item of visible){
      const key=scopeKey(item.scope);let group=groups.get(key);
      if(!group){
        const section=document.createElement('details');section.open=true;
        const heading=document.createElement('summary');heading.textContent=record.result.scopes.find(s=>scopeKey(s)===key)?.displayName??'文件级变更';
        group=document.createElement('div');section.append(heading,group);list.append(section);groups.set(key,group);
      }
      const row=document.createElement('button');row.className=`comparison-change ${item.kind}`;
      const caption=document.createElement('span');caption.textContent=comparisonItemCaption(item,itemNumbers.get(item.id)!);
      const lines=comparisonChangeLines(item);
      const detail=document.createElement('small');detail.textContent=lines.slice(0,3).map(line=>line.length>180?line.slice(0,180)+'…':line).join('；')+(lines.length>3?`；另有 ${lines.length-3} 项属性变化`:'');
      row.title=lines.join('\n');
      row.disabled=ready.size!==2;buttons.push(row);
      row.append(caption,detail);row.onclick=()=>{changes.querySelector('.selected')?.classList.remove('selected');row.classList.add('selected');if(item.scope)activeScope=scopeKey(item.scope);requestId++;replies.clear();navigation.textContent='正在定位…';navigate(item,editors,requestId);};group.append(row);
    }
    if(!visible.length){const empty=document.createElement('p');empty.textContent=record.result.items.length?'当前筛选下没有变更。':'这两个固定版本没有语义变化。';list.append(empty);}
  }
  renderList();loadPanes();
  return {
    getPreferences:():ComparisonPreferences=>({mode,showFormulas,scope:scope.value,search:search.value,activeScope}),
    setDarkMode:(darkMode:boolean)=>{for(const editor of editors)editor.contentWindow?.postMessage({type:'office-theme',darkMode},location.origin);},
    setFreshness:(changed:boolean,message?:string)=>{freshness.textContent=message??(changed?'有更新，刷新后查看':'固定版本');freshness.classList.toggle('has-update',changed);},
    dispose:()=>{window.removeEventListener('message',receive);for(const editor of editors)editor.remove();host.replaceChildren();},
  };
}
function navigate(item:Pick<IUnitComparisonItem,'locations'>,editors:HTMLIFrameElement[],requestId:number){
  for(const[index,side]of (['left','right'] as const).entries())editors[index]?.contentWindow?.postMessage({type:'office-navigate',requestId,target:item.locations[side]?.target},location.origin);
}
