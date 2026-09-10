import {AppBridge,PostMessageTransport,type McpUiHostContext} from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.getElementById('app') as HTMLIFrameElement;
const status=document.getElementById('status')!;
const events=document.getElementById('events')!;
function record(event:string){events.textContent+=`${new Date().toISOString()} ${event}\n`;}
document.addEventListener('fullscreenchange',()=>record(`browser fullscreen=${Boolean(document.fullscreenElement)}`));
document.addEventListener('fullscreenerror',()=>record('browser fullscreenerror'));
let context:McpUiHostContext={theme:'light',locale:'zh-CN',displayMode:'inline',availableDisplayModes:['inline','fullscreen','pip']};
const bridge=new AppBridge(null,{name:'Office protocol test host',version:'0.1.0'},{openLinks:{},serverTools:{}},{hostContext:context});
const get=async(path:string,body?:unknown)=>{const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(!response.ok)throw new Error(await response.text());return response.json();};
bridge.onopenlink=async({url})=>{const link=document.getElementById('open-link') as HTMLAnchorElement;link.href=url;link.hidden=false;status.textContent='已收到打开指定审阅页的请求';return{};};
bridge.oncalltool=async(params)=>get('refresh',params);
bridge.onrequestdisplaymode=async({mode})=>{
  record(`MCP request ${context.displayMode} -> ${mode}`);
  document.body.dataset.mode=mode;
  context={...context,displayMode:mode};bridge.setHostContext(context);
  status.textContent=`显示模式请求已响应：${mode}`;
  record(`MCP response ${mode}`);
  return{mode};
};
bridge.onsizechange=({width,height})=>{
  record(`size mode=${context.displayMode} native=${Boolean(document.fullscreenElement)} width=${width} height=${height}`);
  if(height)frame.style.height=`${Math.min(900,Math.max(300,height))}px`;
};
bridge.oninitialized=()=>{void(async()=>{
  const result=await get('result');
  await bridge.sendToolInput({arguments:{target:result.structuredContent.result.target,capture:true}});
  await bridge.sendToolResult(result);
  status.textContent='MCP Apps 握手完成 · 已传送真实工具结果';
  record('initialized');
})().catch(error=>{status.textContent=String(error);});};
document.getElementById('theme')!.onclick=()=>{const theme=context.theme==='dark'?'light':'dark';context={...context,theme};bridge.setHostContext(context);status.textContent=`宿主主题已切换：${theme}`;};
document.getElementById('locale')!.onclick=()=>{const locale=context.locale==='zh-CN'?'en-US':'zh-CN';context={...context,locale};bridge.setHostContext(context);status.textContent=`宿主语言已切换：${locale}`;record(`locale ${locale}`);};
const targetSelector=document.getElementById('target') as HTMLSelectElement|null;
if(targetSelector)targetSelector.onchange=()=>{void(async()=>{
  targetSelector.disabled=true;
  const result=await get('select',{index:Number(targetSelector.value)});
  await bridge.sendToolResult(result);
  status.textContent=`已传送样例 ${Number(targetSelector.value)+1} 的真实工具结果`;
})().catch(error=>{status.textContent=String(error);}).finally(()=>{targetSelector.disabled=false;});};
void(async()=>{
  const html=await fetch('resource').then(r=>r.text());
  const initial=await get('result');
  const preview=initial._meta?.office?.previewUrl;
  const frameOrigin=preview?new URL(preview).origin:'';
  if(frameOrigin&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(frameOrigin))throw Error('Unexpected preview origin');
  await bridge.connect(new PostMessageTransport(frame.contentWindow!,frame.contentWindow!));
  frame.srcdoc=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src ${frameOrigin||"'none'"}">`);
})().catch(error=>{status.textContent=String(error);});
window.addEventListener('pagehide',()=>void bridge.close());
