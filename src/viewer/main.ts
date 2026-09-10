import type {Root} from 'react-dom/client';
import {renderProductIcon} from './product-icons.js';
import {installTooltips} from './tooltips.js';
import {localeText,resolveOfficeLocale,type OfficeLocale} from '../shared/locale.js';
import {applyEditorLocale,cancelEditorLocale} from './editor-locale.js';
import {LifecycleStages,LocaleType,LogLevel} from '@univerjs/core';
import {createUniver,defaultTheme,mergeLocales} from '@univerjs/presets';
import {UniverSheetsCorePreset} from '@univerjs/preset-sheets-core';
import SheetsZh from '@univerjs/preset-sheets-core/locales/zh-CN';
import {UniverDocsCorePreset} from '@univerjs/preset-docs-core';
import DocsZh from '@univerjs/preset-docs-core/locales/zh-CN';
import {UniverLicensePlugin} from '@univerjs-pro/license';
import {SetSlideZoomRatioOperation} from '@univerjs-pro/slides';
import {UniverCollaborationPlugin} from '@univerjs-pro/collaboration';
import {CollaborationStatus,UniverCollaborationClientPlugin} from '@univerjs-pro/collaboration-client';
import CollaborationZh from '@univerjs-pro/collaboration-client/locale/zh-CN';
import '@univerjs-pro/collaboration-client/facade';
import {BrowserCollaborationSocketService,UniverCollaborationClientUIPlugin} from '@univerjs-pro/collaboration-client-ui';
import CollaborationUIZh from '@univerjs-pro/collaboration-client-ui/locale/zh-CN';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-docs-core/lib/index.css';
import '@univerjs-pro/collaboration-client-ui/lib/index.css';
import {collaborationUrls} from '../shared/urls.js';
import type {UnitRecord} from '../shared/contracts.js';
import type {WorktreeData} from '@univerjs-pro/collaboration-worktree-service';
import './product-responsive.css';
import './shell-tailwind.css';
import {setToolbarIcon} from './toolbar-icons.js';
import type {ToolbarIcon} from './toolbar-icons.js';
import {productPreset,productLocales} from './product-presets.js';
import {mountComparison} from './comparison.js';
import {completeComparison} from '../shared/comparison-pages.js';
import type {ComparisonRecord} from '../application/comparison.js';
import {openDelivery} from './delivery.js';
import {openRemovedDialog} from './removed-dialog.js';
import {renderWorktreeNavigation} from './worktree-navigation.js';
import {renderMergeResults} from './merge-results.js';
import {openRestoreDialog} from './restore-dialog.js';
import {confirmEdit,confirmMerge,confirmDiscard,confirmReady} from './confirm-edit.js';
import type {Target} from '../shared/contracts.js';
import {isPreview,previewPrefix,viewerUrl} from './connection.js';

let previewLocale:OfficeLocale='zh-CN';
const pt=(value:string)=>localeText(isPreview?previewLocale:'zh-CN',value);
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
installTooltips();
setToolbarIcon($<HTMLButtonElement>('#new-file'),'plus','新建文件');
let unitIconRoots:Root[]=[];
function clearUnitIcons(){for(const root of unitIconRoots)root.unmount();unitIconRoots=[];}
type Status={fileId:string;name:string;units:UnitRecord[];worktrees:WorktreeData[]};
let fileId=new URL(location.href).searchParams.get('file')??'', unitId=new URL(location.href).searchParams.get('unit')??'',worktreeId=new URL(location.href).searchParams.get('worktree')??'';
const focusedReview=Boolean(fileId)&&!isPreview;
document.body.classList.toggle('focused-review',focusedReview);
let closeReviewNav=()=>{};
if(!isPreview){
  const toggle=$<HTMLButtonElement>('#toggle-sidebar');
  const narrow=matchMedia('(max-width: 1100px)');
  const backdrop=document.createElement('div');backdrop.id='sidebar-backdrop';backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
  const setNavHidden=(hidden:boolean)=>{
    document.body.classList.toggle('review-nav-hidden',hidden);
    setToolbarIcon(toggle,hidden?'panelOpen':'panelClose',hidden?'展开文件栏':'收起文件栏');
    toggle.setAttribute('aria-expanded',String(!hidden));
    const drawerOpen=narrow.matches&&!hidden;
    backdrop.hidden=!drawerOpen;$('#shell > main').inert=drawerOpen;
    if(drawerOpen)document.querySelector<HTMLButtonElement>('#close-file-sidebar')?.focus();
  };
  setNavHidden(narrow.matches);
  closeReviewNav=()=>setNavHidden(true);
  narrow.addEventListener('change',()=>setNavHidden(narrow.matches));
  toggle.onclick=()=>setNavHidden(!document.body.classList.contains('review-nav-hidden'));
  const close=document.createElement('button');close.id='close-file-sidebar';setToolbarIcon(close,'close','关闭文件栏');
  close.onclick=()=>{setNavHidden(true);toggle.focus();};$('#office-sidebar').prepend(close);
  backdrop.onclick=()=>{setNavHidden(true);toggle.focus();};
  document.addEventListener('keydown',event=>{
    if(!narrow.matches||backdrop.hidden||document.querySelector('dialog[open]'))return;
    if(event.key==='Escape'){event.preventDefault();setNavHidden(true);toggle.focus();}
    if(event.key==='Tab'){
      const stops=Array.from($('#office-sidebar').querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href],summary')).filter(el=>{
        const collapsed=el.closest('details:not([open])');
        return el.getClientRects().length>0&&(!collapsed||collapsed.querySelector('summary')===el);
      });
      const first=stops[0],last=stops.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  $('#office-sidebar').addEventListener('click',event=>{if(narrow.matches&&(event.target as Element).closest('#units button,#worktrees button'))setNavHidden(true);});
}
let status:Status,editor:ReturnType<typeof createUniver>|undefined, mounted='',creating:'file'|'unit'='file';
let fingerprint='',busy=false;
let lastReviewedWorktree=new URL(location.href).searchParams.get('review')??'';
let lastState='';
let previewReview:'merged'|'discarded'|null=null;
let previewRedirecting=false;
let editSession:{target:Target;token:string}|undefined;
async function finishEditing(){
  if(!editSession)return;
  await editor?.univerAPI.getCollaboration().flush(unitId,{timeout:15000});
  await api('/edit-sessions/revoke',{token:editSession.token});
  editSession=undefined;mounted='';lastState='';
}
let comparisonCleanup:(()=>void)|undefined;
let comparisonLoad:AbortController|undefined;
let activeComparison:{record:ComparisonRecord;panel:ReturnType<typeof mountComparison>}|undefined;
let initialViewCleanup:(()=>void)|undefined;
let connectionCleanup:(()=>void)|undefined;
let connectionRefresh:(()=>void)|undefined;
let serviceUnavailable=false,polling=false;
function disposeEditor(){
  connectionCleanup?.();connectionCleanup=undefined;connectionRefresh=undefined;
  initialViewCleanup?.();initialViewCleanup=undefined;
  if(editor)cancelEditorLocale(editor.univerAPI);
  editor?.univer.dispose();editor=undefined;
}
const collaborationLabels:Record<CollaborationStatus,string>={
  [CollaborationStatus.NOT_COLLAB]:'尚未建立协作连接',
  [CollaborationStatus.SYNCED]:'● 已同步',
  [CollaborationStatus.PENDING]:'等待发送更改…',
  [CollaborationStatus.AWAITING]:'等待服务端确认…',
  [CollaborationStatus.AWAITING_WITH_PENDING]:'等待确认，仍有更改待发送…',
  [CollaborationStatus.FETCH_MISS]:'正在补齐远端更改…',
  [CollaborationStatus.CONFLICT]:'正在处理同步冲突…',
  [CollaborationStatus.OFFLINE]:'连接已断开 · 内容可能不是最新版本',
};
class ApiError extends Error{constructor(readonly code:string,message:string){super(message);}}
async function api<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{const response=await fetch(viewerUrl(`/api${path}`),{...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),signal:body===undefined?(signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)):signal});const result=await response.json();if(!response.ok)throw new ApiError(result.code??'REQUEST_FAILED',result.message??response.statusText);return result as T;}
function notify(message:string){$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>{$('#toast').hidden=true;},7000);}
function button(text:string,fn:()=>Promise<unknown>,className=''){const el=document.createElement('button');el.textContent=text;el.className=className;el.onclick=()=>{el.disabled=true;void fn().catch(e=>notify(String(e))).finally(()=>{el.disabled=false;});};return el;}
function iconButton(label:string,icon:ToolbarIcon,fn:()=>Promise<unknown>){const el=button(label,fn);setToolbarIcon(el,icon,pt(label));return el;}
function leaveComparison(){comparisonLoad?.abort();comparisonCleanup?.();comparisonCleanup=undefined;activeComparison=undefined;$('#comparison').hidden=true;mounted='';lastState='';}
async function loadComparison(leftWorktreeId=''){
  if(busy)return;
  const target:Target={fileId,unitId,branch:'worktree',worktreeId};
  if(!worktreeId)throw new Error('请选择待确认修改');
  const controller=new AbortController();comparisonLoad=controller;
  busy=true;$('#loading').textContent='正在准备两个固定版本…';$('#loading').hidden=false;
  try{
    const record=await api<ComparisonRecord>('/comparisons',{target,...(leftWorktreeId?{leftWorktreeId}:{})},controller.signal);
    record.result=await completeComparison(record.result,(offset,contextOffset)=>api(`/files/${target.fileId}/comparisons/${record.comparisonId}/pages?offset=${offset}&contextOffset=${contextOffset}`,undefined,controller.signal),
      (loaded,total)=>{$('#loading').textContent=`正在加载完整对比 · ${loaded} / ${total} 项`;});
    controller.signal.throwIfAborted();
    const config=await api<{license:string}>('/config');
    if(fileId!==target.fileId||unitId!==target.unitId||worktreeId!==target.worktreeId)return;
    const sources=status.worktrees.filter(w=>w.worktreeID!==worktreeId&&['draft','ready','merging'].includes(w.status)&&w.units.some(u=>u.unitID===unitId&&!u.removed)).map(w=>({id:w.worktreeID,name:`${w.status==='ready'?'待确认':'修改中'} · ${w.worktreeID.slice(0,8)}`}));
    const preferences=activeComparison?.panel.getPreferences();
    comparisonCleanup?.();disposeEditor();$('#editor').style.display='none';$('#comparison').hidden=false;
    const panel=mountComparison($('#comparison'),record,config.license,{sources,preferences,onSourceChange:async id=>{await loadComparison(id);await refresh();},onRefresh:async()=>{await loadComparison(record.leftTarget?.worktreeId);await refresh();}});
    activeComparison={record,panel};comparisonCleanup=panel.dispose;
    $('#connection').textContent=`固定对比 · ${record.createdAt.slice(11,19)} · ${record.result.items.length} 项变化`;
  }catch(error){if(!controller.signal.aborted)throw error;}
  finally{if(comparisonLoad===controller)comparisonLoad=undefined;busy=false;$('#loading').hidden=true;$('#loading').textContent='正在加载 Office 编辑器…';lastState='';}
}
async function checkComparisonFreshness(){
  const selected=activeComparison;if(!selected)return;
  try{
    const result=await api<{changed:boolean}>(`/files/${selected.record.rightTarget.fileId}/comparisons/${selected.record.comparisonId}/freshness`);
    if(activeComparison===selected)selected.panel.setFreshness(result.changed);
  }catch(error){
    if(activeComparison===selected)selected.panel.setFreshness(false,error instanceof ApiError&&error.code==='COMPARISON_SOURCE_CLOSED'?'对比来源已结束，当前仍为固定快照':'无法检查更新，当前仍为固定快照');
  }
}
function setLocation(){const url=new URL(location.href);for(const[k,v]of Object.entries({file:fileId,unit:unitId,worktree:worktreeId,review:isPreview?'':lastReviewedWorktree}))v?url.searchParams.set(k,v):url.searchParams.delete(k);history.replaceState(null,'',url);}
async function refresh(){
  if(busy||previewRedirecting)return;
  if(isPreview){
    const resolution=await api<{review:'merged'|'discarded'|null;available:boolean;removed?:boolean;previewUrl:string|null}>('/preview/resolve');
    previewReview=resolution.review;
    if(resolution.previewUrl){
      previewRedirecting=true;
      disposeEditor();
      location.replace(resolution.previewUrl);return;
    }
    if(!resolution.available){
      mounted='';lastState='';disposeEditor();
      $('#editor').replaceChildren();$('#editor').style.display='none';
      $('#state').textContent=pt(resolution.removed?'草稿内容待移除':previewReview==='merged'?'草稿已合入 · 内容已移除':'草稿已丢弃');
      $('#connection').textContent=resolution.removed?'合入前主线内容保持不变，可在审阅页撤销移除':'此内容没有可显示的主线版本';
      return;
    }
  }
  const files=await api<{fileId:string;name:string}[]>('/files');
  if(!fileId&&files[0])fileId=files[0].fileId;
  const nextStatus=fileId?await api<Status>(`/files/${fileId}`):undefined;
  const signature=JSON.stringify({files,nextStatus,fileId,unitId,worktreeId});
  if(signature===lastState)return;
  lastState=signature;
  const fileSelect=$<HTMLSelectElement>('#files');
  fileSelect.replaceChildren(...files.map(f=>new Option(f.name,f.fileId,false,fileId===f.fileId)));
  fileSelect.title=files.find(f=>f.fileId===fileId)?.name??'选择 Office 文件';
  fileSelect.disabled=Boolean(editSession)||!files.length;
  fileSelect.onchange=()=>{
    if(editSession){fileSelect.value=fileId;return;}
    leaveComparison();fileId=fileSelect.value;unitId='';worktreeId='';lastReviewedWorktree='';
    void refresh().catch(error=>notify(String(error)));
  };
  if(!fileId)return;
  status=nextStatus!;
  $('#unavailable-content').hidden=true;
  if(!status.worktrees.some(w=>w.worktreeID===lastReviewedWorktree))lastReviewedWorktree='';
  $('#file-name').textContent=status.name;
  const active=status.worktrees.find(w=>w.worktreeID===worktreeId);
  if(active&&['merged','discarded'].includes(active.status)){
    if(isPreview){lastState='';return;}
    lastReviewedWorktree=active.worktreeID;
    leaveComparison();worktreeId='';
  }
  const visible=status.units.filter(u=>!u.removed&&(worktreeId?status.worktrees.find(w=>w.worktreeID===worktreeId)?.units.some(w=>w.unitID===u.unitId):!u.worktreeId));
  if(!visible.some(u=>u.unitId===unitId))unitId=visible[0]?.unitId??'';
  const kindLabels:Record<UnitRecord['kind'],string>={sheet:'表格',doc:'文档',slide:'演示稿',base:'多维表',board:'画布'};
  clearUnitIcons();
  $('#units').replaceChildren(...status.units.filter(u=>!u.removed&&!u.worktreeId).map(u=>{
    const entry=button('',async()=>{leaveComparison();worktreeId='';unitId=u.unitId;await refresh();},!worktreeId&&unitId===u.unitId?'selected':'');
    const type=document.createElement('span');type.className='unit-kind';type.setAttribute('aria-hidden','true');
    unitIconRoots.push(renderProductIcon(type,u.kind));
    const name=document.createElement('span');name.className='unit-title';name.textContent=u.name;
    entry.append(type,name);entry.title=`${kindLabels[u.kind]} · ${u.name}`;
    entry.setAttribute('aria-label',`${kindLabels[u.kind]} ${u.name}`);
    entry.setAttribute('aria-current',String(!worktreeId&&unitId===u.unitId));return entry;
  }));
  $('#worktree-navigation').hidden=isPreview||!status.worktrees.length;
  $('#worktree-count').textContent=String(status.worktrees.filter(w=>['draft','ready','merging'].includes(w.status)).length);
  renderWorktreeNavigation($('#worktrees'),status.worktrees,status.units,worktreeId,unitId,async(draftId,selectedUnit,reviewId)=>{
    leaveComparison();worktreeId=draftId;unitId=selectedUnit;
    if(reviewId)lastReviewedWorktree=reviewId;
    await refresh().catch(error=>notify(String(error)));
  });
  if(!isPreview)$('#units').append(button('＋ 新建内容',async()=>showDialog('unit')));
  if(!isPreview&&status.units.some(u=>u.removed&&!u.worktreeId))$('#units').append(button('已移除内容',async()=>openRemovedDialog(fileId,async(restoredUnitId)=>{leaveComparison();worktreeId='';unitId=restoredUnitId;await refresh();notify('内容已恢复到列表');})));
  const current=status.worktrees.find(w=>w.worktreeID===worktreeId);
  const state=current?.status??'trunk';
  const mergeResults=$('#merge-results');
  renderMergeResults(mergeResults,isPreview?undefined:current,status.units);
  const unitRemoved=Boolean(current?.units.find(u=>u.unitID===unitId)?.removed);
  $('#removed-content').hidden=!unitRemoved;
  const labels:Record<string,string>={trunk:'当前版本',draft:'修改中 · 只读',ready:'待确认',merging:'合入尚未全部完成'};
  $('#state').textContent=pt(editSession?'正在编辑当前版本':previewReview?`${previewReview==='merged'?'草稿已合入':'草稿已丢弃'} · 当前版本`:labels[state]??state);
  $('#review-description').textContent=editSession?'修改实时保存到已合入的主线版本':state==='ready'?'内容已冻结，审阅后合入当前版本':state==='draft'?'Agent 的修改实时同步到此处':'已确认的内容';
  const actions=$('#actions');actions.replaceChildren();
  const viewActions=focusedReview?$('#view-actions'):actions;
  if(focusedReview)viewActions.replaceChildren();
  const modes=$('#view-mode');modes.replaceChildren();modes.hidden=true;
  if(current&&!isPreview){
    const review=await api<{fingerprint:string}>(`/files/${fileId}/review/${worktreeId}`);fingerprint=review.fingerprint;
    const act=async(action:string)=>{
      const reviewedFingerprint=fingerprint;
      const name=status.units.find(u=>u.unitId===unitId)?.name??status.name;
      if(action==='merge'&&!await confirmMerge(name))return;
      if(action==='discard'&&!await confirmDiscard(name))return;
      if(action==='ready'&&!await confirmReady(name))return;
      const result=await api<{worktree?:WorktreeData}>(`/files/${fileId}/review/${worktreeId}`,{action,fingerprint:reviewedFingerprint});
      if(action==='merge'){
        lastReviewedWorktree=worktreeId;
        if(result.worktree?.status==='merged'&&!unitRemoved){
          const target:Target={fileId,unitId,branch:'trunk'};
          editSession=await api<{target:Target;token:string}>('/edit-sessions',{target,confirmed:true});
        }
      }
      notify(action==='merge'?(result.worktree?.status==='merged'?'已合入当前版本':'部分修改未合入，请查看原因'):action==='discard'?'已丢弃修改':'已提交确认');await refresh();
    };
    if(state==='draft'){actions.append(button('提交确认',()=>act('ready'),'primary'),button('丢弃',()=>act('discard'),'danger'));}
    if(state==='ready'){actions.append(button(current.units.some(u=>u.mergeResult)?'重试合入':'合入当前版本',()=>act('merge'),'primary'),button('丢弃',()=>act('discard'),'danger'));}
    if(state==='merging')actions.append(button('重试合入未完成项',()=>act('merge'),'primary'));
    if(!unitRemoved){
      const toggleComparison=async()=>{
      await finishEditing();
      if(comparisonCleanup){leaveComparison();await refresh();return;}
      if($('#shell > main').clientWidth<=1100)closeReviewNav();
      await loadComparison();
      await refresh();
    };
    modes.hidden=false;
    const viewing=button('查看',async()=>{if(comparisonCleanup)await toggleComparison();});
    const comparing=button('对比',async()=>{if(!comparisonCleanup)await toggleComparison();});
    if(editSession)viewing.textContent='编辑';
    viewing.setAttribute('aria-pressed',String(!comparisonCleanup));comparing.setAttribute('aria-pressed',String(Boolean(comparisonCleanup)));
    viewing.title='查看当前内容';comparing.title='对比当前版本与本次草稿';modes.append(viewing,comparing);
    }
  }
  setLocation();
  const unit=status.units.find(u=>u.unitId===unitId);$('#unit-name').textContent=unit?.name??status.name;
  if(unitRemoved){
    if(comparisonCleanup)leaveComparison();mounted='';disposeEditor();$('#editor').replaceChildren();$('#editor').style.display='none';$('#empty').style.display='none';
    $('#loading').hidden=true;$('#connection').textContent='待移除 · 合入前主线内容保持不变';return;
  }

  if(unit&&!isPreview&&!comparisonCleanup&&!unitRemoved&&!worktreeId&&status.worktrees.some(w=>w.status==='merged'&&w.units.some(u=>u.unitID===unitId&&['merged','unchanged'].includes(u.mergeResult?.status??'')))){
    viewActions.append(button(editSession?'完成编辑':'开启编辑',async()=>{
      if(editSession){await finishEditing();await refresh();return;}
      const selected={fileId,unitId,branch:worktreeId?'worktree':'trunk',...(worktreeId?{worktreeId}:{})} as Target;
      const confirmedFingerprint=fingerprint;
      if(!await confirmEdit(unit.name))return;
      busy=true;
      try{
        if(fileId!==selected.fileId||unitId!==selected.unitId||worktreeId!==(selected.worktreeId??''))throw new Error('内容已切换，请重新确认。');
        editSession=await api<{target:Target;token:string}>('/edit-sessions',{target:selected,confirmed:true,fingerprint:confirmedFingerprint});
        worktreeId='';mounted='';lastState='';
      }finally{busy=false;}
      await refresh();
    }));
  }
  // Complete and synchronize the current edit session before leaving this content.
  document.querySelectorAll<HTMLButtonElement>('#units button,#worktrees button,#new-file,#actions button').forEach(button=>button.disabled=Boolean(editSession)||button.dataset.unavailable==='true');
  if(unit?.kind==='slide'&&!comparisonCleanup)viewActions.append(iconButton('适应页面','fit',fitSlide));
  if(unit&&!worktreeId&&!isPreview&&!comparisonCleanup){
    viewActions.append(iconButton('历史版本','history',async()=>{
      const activeEditor=editor;
      const {historyOperationIds}=await import('./history.js');
      if(!activeEditor||editor!==activeEditor)return;
      const opened=await activeEditor.univerAPI.executeCommand(historyOperationIds[unit.kind]);
      if(opened===false)throw new Error('无法打开此内容的历史版本');
    }));
    if(editSession)viewActions.append(iconButton('恢复历史版本','restore',async()=>{
      const selectedFile=fileId,selectedUnit=unitId,token=editSession!.token;
      await editor?.univerAPI.getCollaboration().flush(selectedUnit,{timeout:15000});
      if(editSession?.token!==token)return;
      openRestoreDialog(selectedFile,selectedUnit,token,async(revision)=>{
        notify(`历史内容已恢复为新版本 ${revision}`);
      },async(operation)=>{
        if(fileId!==selectedFile||unitId!==selectedUnit||worktreeId||editSession?.token!==token)throw new Error('编辑授权或目标已变化，请重新确认。');
        await editor?.univerAPI.getCollaboration().flush(selectedUnit,{timeout:15000});
        // A restore deliberately replaces the current model. Disconnect it before
        // the server broadcasts that replacement, then load its confirmed head.
        busy=true;disposeEditor();
        try{return await operation();}
        finally{busy=false;mounted='';lastState='';await refresh();}
      });
    }));
  }
  if(unit&&!comparisonCleanup&&!isPreview)viewActions.append(iconButton('导出','download',async()=>{
    openDelivery({target:{fileId,unitId,branch:worktreeId?'worktree':'trunk',...(worktreeId?{worktreeId}:{})},kind:unit.kind,name:unit.name,
      tables:unit.kind==='base'?editor?.univerAPI.getActiveBase()?.getTables().map(table=>({id:table.getId(),name:table.getName(),views:table.getViews().map(view=>({id:view.getId(),name:view.getName()}))})):undefined});
  }));
  const key=[fileId,unitId,worktreeId,state,editSession?.token??''].join('/');
  if(key!==mounted&&!comparisonCleanup){
    try{
      await mount(unit,state);
      mounted=key;
    }catch(error){
      // A failed initialization is not a mounted revision. Clear both caches so
      // the next successful status poll retries even when file data is unchanged.
      mounted='';lastState='';disposeEditor();
      throw error;
    }
  }
}
async function mount(unit:UnitRecord|undefined,state:string){
  disposeEditor();$('#editor').replaceChildren();
  $('#empty').style.display=unit?'none':'flex';$('#editor').style.display=unit?'block':'none';
  if(!unit){$('#connection').textContent=pt('当前文件暂无内容');return;}
  $('#loading').hidden=false;$('#connection').textContent=pt('连接协作服务…');
  try{
    const config=await api<{license:string}>('/config');
    const history=!isPreview&&!worktreeId?await import('./history.js'):undefined;
    const sessionUrl=(url:string)=>{if(!editSession)return url;const next=new URL(url);next.pathname=`/edit/${editSession.token}${next.pathname}`;return next.href;};
    const urls=Object.fromEntries(Object.entries(collaborationUrls(location.origin,fileId,worktreeId||undefined,previewPrefix)).map(([key,url])=>[key,sessionUrl(url)]));
    editor=createUniver({locale:LocaleType.ZH_CN,locales:{[LocaleType.ZH_CN]:mergeLocales(SheetsZh,DocsZh,CollaborationZh,CollaborationUIZh,...productLocales,...(history?.historyLocales??[]))},theme:defaultTheme,logLevel:LogLevel.WARN,collaboration:true,
      presets:[{plugins:[[UniverLicensePlugin,{license:config.license}]]},productPreset(unit.kind,'editor',true,Boolean(editSession))],
      plugins:[UniverCollaborationPlugin,[UniverCollaborationClientPlugin,{socketService:BrowserCollaborationSocketService,sendChangesetTimeout:200,authzUrl:sessionUrl(`${location.origin}${viewerUrl(`/api/files/${fileId}/permissions/${worktreeId||'trunk'}`)}`),...urls}],UniverCollaborationClientUIPlugin,...(history?.historyPlugins(unit.kind,`${location.origin}/files/${encodeURIComponent(fileId)}/universer-api/history`)??[])]});
    const activeEditor=editor;
    if(isPreview)await applyEditorLocale(activeEditor.univerAPI,previewLocale);
    if(editor!==activeEditor)return;
    const activeUnitId=unitId;
    const collaboration=activeEditor.univerAPI.getCollaboration();
    const mode=isPreview?'只读预览':editSession?'主线可编辑':'只读查看';
    const showConnection=(connectionStatus:CollaborationStatus)=>{
      if(editor===activeEditor&&!serviceUnavailable)$('#connection').textContent=`${pt(collaborationLabels[connectionStatus])} · ${pt(mode)}`;
    };
    const connectionSubscription=activeEditor.univerAPI.addEvent(activeEditor.univerAPI.Event.CollaborationStatusChanged,event=>{
      if(event.unitId===activeUnitId)showConnection(event.status);
    });
    connectionCleanup=()=>connectionSubscription.dispose();
    connectionRefresh=()=>showConnection(collaboration.getCollaborationStatus(activeUnitId));
    if(unit.kind==='sheet')await collaboration.loadSheetAsync(unitId);
    else if(unit.kind==='doc')await collaboration.loadDocAsync(unitId);
    else if(unit.kind==='slide')await collaboration.loadSlideAsync(unitId);
    else if(unit.kind==='base')await collaboration.loadBaseAsync(unitId);
    else await collaboration.loadBoardAsync(unitId);
    // The SDK consumes the server's per-Unit edit permissions. Keep its view
    // controls interactive in review mode so users can scroll, zoom and navigate.
    editor.univerAPI.toggleDarkMode(document.body.classList.contains('dark'));
    if(unit.kind==='slide'){
      const activeEditor=editor;
      const fitWhenReady=()=>{
        if(editor!==activeEditor||activeEditor.univerAPI.getCurrentLifecycleStage()<LifecycleStages.Steady)return;
        initialViewCleanup?.();initialViewCleanup=undefined;
        void fitSlide().catch(error=>notify(String(error)));
      };
      const subscription=activeEditor.univerAPI.addEvent(activeEditor.univerAPI.Event.LifeCycleChanged,fitWhenReady);
      initialViewCleanup=()=>subscription.dispose();
      fitWhenReady();
    }
    showConnection(collaboration.getCollaborationStatus(activeUnitId));
  }finally{$('#loading').hidden=true;}
}
async function fitSlide(){
  const activeEditor=editor;
  if(!activeEditor)return;
  // Canvas dimensions settle after the SDK has mounted its thumbnail/sidebar UI.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  if(editor!==activeEditor)return;
  const presentation=activeEditor.univerAPI.getActivePresentation();
  if(!presentation)return;
  const canvas=[...$('#editor').querySelectorAll('canvas')]
    .map(node=>node.getBoundingClientRect()).sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  const page=presentation.getPageSize();
  if(!canvas||canvas.width<=80||canvas.height<=80)return;
  const zoomRatio=Math.max(0.1,Math.min(1,(canvas.width-80)/page.width,(canvas.height-80)/page.height));
  await activeEditor.univerAPI.executeCommand(SetSlideZoomRatioOperation.id,{unitId:presentation.id,zoomRatio});
}
function showDialog(kind:'file'|'unit'){creating=kind;$('#dialog-title').textContent=kind==='file'?'新建 Office 文件':'新建内容';$('#kind-label').hidden=kind==='file';$<HTMLInputElement>('#create-name').value='';$<HTMLDialogElement>('#create-dialog').showModal();}
$('#new-file').onclick=()=>showDialog('file');$('#start').onclick=()=>showDialog('file');$('#cancel').onclick=()=>$<HTMLDialogElement>('#create-dialog').close();
$('#create-form').onsubmit=event=>{event.preventDefault();void(async()=>{busy=true;const name=$<HTMLInputElement>('#create-name').value.trim();if(creating==='file'){const file=await api<{fileId:string}>('/files',{file:name.endsWith('.univer')?name:`${name}.univer`});fileId=file.fileId;worktreeId='';unitId='';}else{if(!worktreeId){const draft=await api<WorktreeData>(`/files/${fileId}/worktrees`,{});worktreeId=draft.worktreeID;}const unit=await api<UnitRecord>(`/files/${fileId}/units`,{worktreeId,kind:$<HTMLSelectElement>('#create-kind').value,name});unitId=unit.unitId;}$<HTMLDialogElement>('#create-dialog').close();})().catch(e=>notify(String(e))).finally(()=>{busy=false;void pollStatus();});};
$('#fullscreen').onclick=()=>{void(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(e=>notify(String(e)));};
const updateFullscreenIcon=()=>setToolbarIcon($<HTMLButtonElement>('#fullscreen'),document.fullscreenElement?'shrink':'expand',pt(document.fullscreenElement?'退出全屏':'全屏'));
updateFullscreenIcon();document.addEventListener('fullscreenchange',updateFullscreenIcon);
document.body.classList.toggle('embedded-preview',isPreview);
if(isPreview){$('#review-description').textContent='只读实时预览';document.querySelector('#shell > main > footer > span:last-child')!.textContent='WorkBuddy · 实时 Office 预览';}
document.body.classList.toggle('dark',localStorage.getItem('office-theme')==='dark');
const updateThemeIcon=()=>setToolbarIcon($<HTMLButtonElement>('#theme'),document.body.classList.contains('dark')?'sun':'moon',pt(document.body.classList.contains('dark')?'切换浅色主题':'切换深色主题'));
updateThemeIcon();
$('#theme').onclick=()=>{const dark=document.body.classList.toggle('dark');localStorage.setItem('office-theme',dark?'dark':'light');editor?.univerAPI.toggleDarkMode(dark);activeComparison?.panel.setDarkMode(dark);updateThemeIcon();};
// A preview's parent may supply presentation preferences, never editing authority.
function updatePreviewLabels(){
  if(!isPreview)return;
  document.documentElement.lang=previewLocale;
  $('#loading').textContent=pt('正在加载 Office 编辑器…');
  $('#review-description').textContent=pt('只读实时预览');
  document.querySelector('#shell > main > footer > span:last-child')!.textContent=pt('WorkBuddy · 实时 Office 预览');
  $('#unavailable-content h2').textContent=pt('文件暂时不可用');
  $('#unavailable-content p').textContent=pt('文件可能已移走、删除或被替换。已停止当前预览和操作，请恢复原文件，或重新打开文件。');
  updateThemeIcon();updateFullscreenIcon();connectionRefresh?.();
  // Re-render status and tooltips on the next poll without replacing the editor.
  lastState='';
}
window.addEventListener('message',event=>{
  if(!isPreview||event.source!==parent||!['office-host-theme','office-host-context'].includes(event.data?.type))return;
  if(['light','dark'].includes(event.data.theme)){
    const dark=event.data.theme==='dark';document.body.classList.toggle('dark',dark);editor?.univerAPI.toggleDarkMode(dark);updateThemeIcon();
  }
  if(event.data.type==='office-host-context'){
    const next=resolveOfficeLocale(event.data.locale,previewLocale);
    if(next!==previewLocale){
      previewLocale=next;updatePreviewLabels();
      if(editor)void applyEditorLocale(editor.univerAPI,next).catch(error=>notify(String(error)));
    }
  }
});
async function pollStatus(){
  // A stalled service must not accumulate overlapping requests or leave a stale
  // success label visible. Read requests have a deadline; writes keep their own lifecycle.
  if(polling||busy)return;
  polling=true;
  try{
    await refresh();
    await checkComparisonFreshness();
    if(serviceUnavailable){serviceUnavailable=false;connectionRefresh?.();}
  }catch(error){
    serviceUnavailable=true;
    if(error instanceof ApiError&&['FILE_UNAVAILABLE','FILE_NOT_FOUND'].includes(error.code)){
      leaveComparison();disposeEditor();mounted='';lastState='';
      $('#editor').style.display='none';$('#empty').style.display='none';$('#removed-content').hidden=true;$('#loading').hidden=true;
      $('#actions').replaceChildren();clearUnitIcons();$('#units').replaceChildren();$('#worktree-navigation').hidden=true;$('#merge-results').hidden=true;
      document.querySelectorAll('dialog[open]').forEach(dialog=>(dialog as HTMLDialogElement).close());
      $('#unavailable-content').hidden=false;$('#state').textContent=pt('文件不可用');$('#review-description').textContent=error.message;
      $('#connection').textContent=pt('文件不可用 · 已停止当前预览，等待原文件恢复');
      return;
    }
    $('#connection').textContent=pt('无法确认服务状态 · 内容可能不是最新版本 · 正在重试…');
  }finally{polling=false;}
}
const timer=setInterval(()=>void pollStatus(),3000);
window.addEventListener('beforeunload',event=>{if(editSession&&editor?.univerAPI.getCollaboration().getCollaborationStatus(unitId)!==CollaborationStatus.SYNCED){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{if(editSession)void fetch('/api/edit-sessions/revoke',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:editSession.token}),keepalive:true});clearInterval(timer);comparisonLoad?.abort();comparisonCleanup?.();disposeEditor();});
void pollStatus();
