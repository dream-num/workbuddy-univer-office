import {createUniver,defaultTheme,mergeLocales} from '@univerjs/presets';
import './product-responsive.css';
import {LifecycleStages,LocaleType,LogLevel} from '@univerjs/core';
import {SetSlideZoomRatioOperation} from '@univerjs-pro/slides';
import {UniverLicensePlugin} from '@univerjs-pro/license';
import SheetsZh from '@univerjs/preset-sheets-core/locales/zh-CN';
import DocsZh from '@univerjs/preset-docs-core/locales/zh-CN';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-docs-core/lib/index.css';
import {productPreset,productLocales} from './product-presets.js';
import {navigateComparison} from './comparison-navigation.js';
import {ComparisonHighlightPlugin} from './comparison-highlight.js';
import type {ComparisonMark} from './comparison-highlight.js';
import type {ComparisonHighlighter} from './comparison-highlight.js';
import type {UnitKind} from '../shared/contracts.js';
import {ComparisonFormulaPlugin} from './comparison-formulas.js';
let editor:ReturnType<typeof createUniver>|undefined;
let kind:UnitKind|undefined;
let highlights:ComparisonHighlighter|undefined,marks:ComparisonMark[]=[];
let surfaceTimer:ReturnType<typeof setInterval>|undefined;
let scopeTimer:ReturnType<typeof setInterval>|undefined;
let lastScope='';
function currentScope(){
 const api=editor?.univerAPI;
 return kind==='sheet'?{entityType:'worksheet',stableId:api?.getActiveWorkbook()?.getActiveSheet()?.getSheetId()}:
   kind==='slide'?{entityType:'slide',stableId:api?.getActivePresentation()?.getActiveSlide()?.getId()}:
   kind==='base'?{entityType:'table',stableId:api?.getBaseUI().getActiveTableId()}:null;
}
let highlightFrame=0,snapshotReady=false,pendingForce=false;
function refreshHighlights(force=false){
  if(!snapshotReady||!kind||!editor||!highlights)return;
  pendingForce ||= force;
  cancelAnimationFrame(highlightFrame);
  highlightFrame=requestAnimationFrame(()=>{const force=pendingForce;pendingForce=false;if(editor&&highlights&&kind)void highlights.show(editor.univerAPI,kind,marks,force).catch(error=>parent.postMessage({type:'office-snapshot-error',detail:`高亮加载失败：${String(error)}`},location.origin));});
}

window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const message=event.data;
  try{
  if(message?.type==='office-snapshot'){
    kind=message.kind;snapshotReady=false;
    editor?.univer.dispose();highlights=undefined;clearInterval(surfaceTimer);marks=message.marks??[];
    editor=createUniver({locale:LocaleType.ZH_CN,locales:{[LocaleType.ZH_CN]:mergeLocales(SheetsZh,DocsZh,...productLocales)},theme:defaultTheme,darkMode:Boolean(message.darkMode),logLevel:LogLevel.WARN,presets:[{plugins:[[UniverLicensePlugin,{license:message.license}]]},productPreset(message.kind,'snapshot')],plugins:[[ComparisonHighlightPlugin,{ready:(service:ComparisonHighlighter)=>{highlights=service;},refresh:()=>refreshHighlights()}],...(message.kind==='sheet'&&message.showFormulas?[ComparisonFormulaPlugin]:[])]});
    const api=editor.univerAPI;
    if(message.kind==='sheet')api.createWorkbook(message.unitData);
    else if(message.kind==='doc')await api.createDocument(message.unitData).getPermission().setReadOnly();
    else if(message.kind==='slide')await api.createPresentation(message.unitData).getPermission().setReadOnly();
    else if(message.kind==='base')await api.createBase(message.unitData).getPermission().setReadOnly();
    else if(message.kind==='board')await api.createBoard(message.unitData).getPermission().setReadOnly();
    if(message.kind==='sheet')await api.getActiveWorkbook()?.getWorkbookPermission().setMode('viewer');
    if(api.getCurrentLifecycleStage()<LifecycleStages.Steady)await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{subscription.dispose();reject(new Error('固定预览加载超时'));},15000);
      const subscription=api.addEvent(api.Event.LifeCycleChanged,()=>{if(api.getCurrentLifecycleStage()>=LifecycleStages.Steady){clearTimeout(timer);subscription.dispose();resolve();}});
    });
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    if(message.kind!=='base'&&!document.querySelector('#snapshot canvas'))throw new Error('固定预览画布未能加载');
    if(kind==='slide'){
      const presentation=api.getActivePresentation();
      const canvas=[...document.querySelectorAll('#snapshot canvas')].map(c=>c.getBoundingClientRect()).sort((a,b)=>b.width*b.height-a.width*a.height)[0];
      if(presentation&&canvas){const size=presentation.getPageSize();await api.executeCommand(SetSlideZoomRatioOperation.id,{unitId:presentation.getId(),zoomRatio:Math.max(.1,Math.min(1,(canvas.width-80)/size.width,(canvas.height-80)/size.height))});}
    }
    snapshotReady=true;refreshHighlights(true);
    if(kind==='doc'||kind==='base')surfaceTimer=setInterval(()=>refreshHighlights(),150);
    lastScope=JSON.stringify(currentScope());
    parent.postMessage({type:'office-snapshot-ready',scope:currentScope()},location.origin);
    clearInterval(scopeTimer);
    scopeTimer=setInterval(()=>{
      const scope=currentScope();
      const key=JSON.stringify(scope);if(!scope?.stableId||key===lastScope)return;lastScope=key;
      parent.postMessage({type:'office-scope-changed',scope},location.origin);
    },300);
  }else if(message?.type==='office-theme'){
    editor?.univerAPI.toggleDarkMode(Boolean(message.darkMode));refreshHighlights(true);
  }else if(message?.type==='office-marks'){
    marks=message.marks??[];refreshHighlights(true);
  }else if(message?.type==='office-navigate'){
    if(!editor||!kind)throw new Error('对比内容尚未就绪');
    const detail=await navigateComparison(editor.univerAPI,kind,message.target);
    // Programmatic navigation is acknowledged separately; do not echo it as a user scope change.
    lastScope=JSON.stringify(currentScope());
    refreshHighlights(true);
    parent.postMessage({type:'office-navigation-result',requestId:message.requestId,detail},location.origin);
  }
  }catch(error){parent.postMessage({type:message?.type==='office-snapshot'?'office-snapshot-error':'office-navigation-result',requestId:message?.requestId,detail:error instanceof Error?error.message:String(error)},location.origin);}
});
window.addEventListener('pagehide',()=>{clearInterval(surfaceTimer);clearInterval(scopeTimer);cancelAnimationFrame(highlightFrame);editor?.univer.dispose();});
