import {App} from '@modelcontextprotocol/ext-apps';
import type {Target} from '../shared/contracts.js';
import {kinds,type UnitKind} from '../shared/contracts.js';
import {renderProductIcon,productNames} from '../viewer/product-icons.js';
import {setToolbarIcon} from '../viewer/toolbar-icons.js';
import {installTooltips} from '../viewer/tooltips.js';
import {localeText,resolveOfficeLocale,type OfficeLocale} from '../shared/locale.js';
import './styles.css';
let locale:OfficeLocale='zh-CN';
const t=(value:string)=>localeText(locale,value);
const app=new App({name:'workbuddy-univer-office',version:'0.1.0'},{availableDisplayModes:['inline','fullscreen','pip']},{autoResize:false});
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const disposeTooltips=installTooltips();
let iconRoot:ReturnType<typeof renderProductIcon>|undefined,iconKind:UnitKind|undefined;
function updateLabels(){
  document.documentElement.lang=locale;document.title=t('Univer Office 预览');
  setToolbarIcon(element<HTMLButtonElement>('refresh'),'refresh',t('刷新预览'));
  setToolbarIcon(element<HTMLButtonElement>('fullscreen'),'expand',t('全屏'));
  setToolbarIcon(element<HTMLButtonElement>('pip'),'pip',t('浮窗'));
  setToolbarIcon(element<HTMLButtonElement>('inline'),'shrink',t('返回卡片'));
  element('review').textContent=t('打开编辑与审阅');
  document.querySelector('[role="toolbar"]')!.setAttribute('aria-label',t('预览操作'));
  document.querySelector('footer')!.textContent=t('内嵌预览只读并实时同步；截图为捕获时的已确认版本。编辑、合入或丢弃请打开审阅页。');
  if(!latestResult){element('subtitle').textContent=t('连接预览…');element('state').textContent=t('等待工具结果');}
}
let latestResult:Parameters<NonNullable<typeof app.ontoolresult>>[0]|undefined;
let refreshing=false;
updateLabels();
let selected:Target|undefined,launchUrl:string|undefined;
function error(value:unknown){element('error').textContent=String(value);}
let connected=false,sizeFrame=0,lastInlineSize='';
// Fullscreen/PIP dimensions belong to the host's overlay, not the chat card.
// Reporting them as card sizes can resize the conversation underneath it.
function scheduleInlineSize(){
  if(sizeFrame||!connected)return;
  sizeFrame=requestAnimationFrame(()=>{
    sizeFrame=0;
    if(!connected||document.fullscreenElement||document.documentElement.dataset.mode!=='inline')return;
    const width=Math.ceil(window.innerWidth),height=Math.ceil(document.body.getBoundingClientRect().height);
    const key=`${width}:${height}`;
    if(key===lastInlineSize)return;
    lastInlineSize=key;
    void app.sendSizeChanged({width,height}).catch(error);
  });
}
const sizeObserver=new ResizeObserver(scheduleInlineSize);
function sendHostPreferences(){
  const frame=element<HTMLIFrameElement>('live'),src=frame.getAttribute('src'),theme=app.getHostContext()?.theme;
  if(src)frame.contentWindow?.postMessage({type:'office-host-context',theme,locale},new URL(src).origin);
}
function applyContext(context:ReturnType<typeof app.getHostContext>){
  if(context?.theme){document.documentElement.dataset.theme=context.theme;document.documentElement.style.colorScheme=context.theme;}
  const next=resolveOfficeLocale(context?.locale,locale);
  if(next!==locale){
    locale=next;updateLabels();
    if(latestResult){const message=element('error').textContent;render(latestResult);element('error').textContent=message;}
  }
  sendHostPreferences();
  const modes=new Set(context?.availableDisplayModes??[]);
  if(document.fullscreenEnabled){modes.add('fullscreen');modes.add('inline');}
  const current=document.fullscreenElement?'fullscreen':context?.displayMode??'inline';
  for(const mode of ['fullscreen','pip','inline'] as const)element(mode).hidden=!modes.has(mode)||current===mode;
  document.documentElement.dataset.mode=current;
  if(current!=='inline')lastInlineSize='';
  else scheduleInlineSize();
}
function render(result:Parameters<NonNullable<typeof app.ontoolresult>>[0],reloadPreview=false){
  if(result.isError){error(result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')??t('预览失败'));return;}
  const data=(result.structuredContent as {result?:{target:Target;name:string;kind:string;state:string;revision:number|null;capturedAt:string|null}}|undefined)?.result;
  if(!data?.target)return;
  latestResult=result;
  selected=data.target;
  const meta=result._meta?.office as {launchUrl?:string;previewUrl?:string;images?:{data:string;width:number;height:number}[]}|undefined;
  launchUrl=undefined;
  if(meta?.launchUrl){const url=new URL(meta.launchUrl);if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/launch')launchUrl=url.href;}
  let previewUrl:string|undefined;
  if(meta?.previewUrl){const url=new URL(meta.previewUrl);if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&/^\/preview\/[a-f0-9]{64}\/$/.test(url.pathname))previewUrl=url.href;}
  element('title').textContent=data.name;
  if(kinds.includes(data.kind as UnitKind)){
    const kind=data.kind as UnitKind;
    if(iconKind!==kind){iconRoot?.unmount();iconRoot=renderProductIcon(element('product-icon'),kind);iconKind=kind;}
    element('title').setAttribute('aria-label',`${t(productNames[kind])} · ${data.name}`);
  }
  element('subtitle').textContent=`${t(data.target.branch==='worktree'?'草稿':'当前版本')}${data.revision===null?'':` · ${t('版本')} ${data.revision}`}${data.capturedAt?` · ${new Date(data.capturedAt).toLocaleTimeString(locale)}`:''}`;
  element('state').textContent=t(({draft:'正在编辑草稿',ready:'等待你的审阅',merged:'已合入',discarded:'已丢弃',trunk:'当前版本',merging:'部分合入，需检查结果'} as Record<string,string>)[data.state]??data.state);
  element('live').hidden=!previewUrl;element('images').hidden=Boolean(previewUrl);element('state').hidden=Boolean(previewUrl);
  if(previewUrl){
    let frame=element<HTMLIFrameElement>('live');
    // Explicit refresh also recovers an expired or failed browsing context.
    // Automatic results keep the existing editor and its view position.
    if(reloadPreview){
      const replacement=frame.cloneNode(false) as HTMLIFrameElement;
      replacement.removeAttribute('src');frame.replaceWith(replacement);frame=replacement;
    }
    frame.onload=sendHostPreferences;
    if(frame.src!==previewUrl)frame.src=previewUrl;
    frame.title=`${data.name} · ${t('只读实时预览')}`;
    element('subtitle').textContent=t('只读实时预览');
  }
  element('images').replaceChildren();
  for(const [index,image]of(meta?.images??[]).entries()){
    const img=document.createElement('img');img.src=`data:image/png;base64,${image.data}`;img.alt=`${data.name} · ${locale==='en-US'?`Page ${index+1}`:`第 ${index+1} 页`}`;img.width=image.width;img.height=image.height;element('images').append(img);
  }
  if(!meta?.images?.length)element('images').textContent=t('尚未生成图片，点击“刷新预览”获取当前内容。');
  element<HTMLButtonElement>('review').disabled=!launchUrl;element<HTMLButtonElement>('refresh').disabled=refreshing;element('error').textContent='';
}
app.ontoolresult=render;
app.onhostcontextchanged=()=>applyContext(app.getHostContext());
app.ontoolcancelled=()=>error(t('预览调用已取消。'));
element('review').onclick=()=>{if(launchUrl)void app.openLink({url:launchUrl}).then(result=>{if(result.isError)error(t('客户端未能打开审阅页。'));}).catch(error);};
element('refresh').onclick=()=>{
  if(!selected)return;
  refreshing=true;element<HTMLButtonElement>('refresh').disabled=true;
  const capture=element<HTMLIFrameElement>('live').hidden;
  void app.callServerTool({name:'univer_preview',arguments:{target:selected,capture}}).then(result=>render(result,true)).catch(error).finally(()=>{refreshing=false;element<HTMLButtonElement>('refresh').disabled=false;});
};
let inlineScroll:{x:number;y:number;imagesX:number;imagesY:number}|undefined;
document.addEventListener('fullscreenchange',()=>{
  applyContext(app.getHostContext());
  if(!document.fullscreenElement&&inlineScroll){
    const saved=inlineScroll;inlineScroll=undefined;
    requestAnimationFrame(()=>{window.scrollTo(saved.x,saved.y);element('images').scrollTo(saved.imagesX,saved.imagesY);});
  }
});
async function requestHostMode(mode:'fullscreen'|'pip'|'inline'){
  const result=await app.requestDisplayMode({mode});
  applyContext({...app.getHostContext(),displayMode:result.mode});
  if(result.mode!==mode)error(t('客户端保留了当前显示模式，可通过“打开编辑与审阅”查看完整内容。'));
  else element('error').textContent='';
}
for(const mode of ['fullscreen','pip','inline'] as const)element(mode).onclick=()=>{
  element('error').textContent='';
  // Call synchronously from the click: native fullscreen requires user activation.
  if(mode==='fullscreen'&&document.fullscreenEnabled){
    inlineScroll={x:window.scrollX,y:window.scrollY,imagesX:element('images').scrollLeft,imagesY:element('images').scrollTop};
    void document.documentElement.requestFullscreen().catch(value=>{
      inlineScroll=undefined;
      if(app.getHostContext()?.availableDisplayModes?.includes('fullscreen'))void requestHostMode('fullscreen').catch(error);
      else error(value);
    });
    return;
  }
  if(mode==='inline'&&document.fullscreenElement){void document.exitFullscreen().catch(error);return;}
  void requestHostMode(mode).catch(error);
};
app.onteardown=async()=>{connected=false;sizeObserver.disconnect();cancelAnimationFrame(sizeFrame);disposeTooltips();iconRoot?.unmount();iconRoot=undefined;iconKind=undefined;element('images').replaceChildren();element<HTMLIFrameElement>('live').removeAttribute('src');launchUrl=undefined;selected=undefined;latestResult=undefined;return{};};
void app.connect().then(()=>{connected=true;sizeObserver.observe(document.documentElement);sizeObserver.observe(document.body);applyContext(app.getHostContext());}).catch(error);
