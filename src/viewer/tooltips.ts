/** One tooltip for the application shell; supports pointer, keyboard, Escape and viewport edges. */
export function installTooltips() {
  const controller=new AbortController(),options={signal:controller.signal};
  const tip=document.createElement('div');tip.id='office-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
  let active:HTMLElement|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  const hide=()=>{clearTimeout(timer);active?.removeAttribute('aria-describedby');active=null;tip.hidden=true;};
  const show=(target:HTMLElement)=>{
    hide();active=target;
    timer=setTimeout(()=>{
      if(!target.isConnected)return hide();
      tip.textContent=target.dataset.tooltip??'';tip.hidden=false;target.setAttribute('aria-describedby',tip.id);
      const box=target.getBoundingClientRect(),size=tip.getBoundingClientRect();
      tip.style.left=`${Math.max(8,Math.min(innerWidth-size.width-8,box.left+(box.width-size.width)/2))}px`;
      tip.style.top=`${box.bottom+size.height+12<innerHeight?box.bottom+6:Math.max(8,box.top-size.height-6)}px`;
    },200);
  };
  const find=(event:Event)=>event.target instanceof Element?event.target.closest<HTMLElement>('[data-tooltip]'):null;
  document.addEventListener('pointerover',event=>{const target=find(event);if(target&&target!==active)show(target);},options);
  document.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget as Node))hide();},options);
  document.addEventListener('focusin',event=>{const target=find(event);if(target)show(target);},options);
  document.addEventListener('focusout',hide,options);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},options);
  document.addEventListener('pointerdown',hide,options);
  window.addEventListener('resize',hide,options);document.addEventListener('scroll',hide,{...options,capture:true});
  return()=>{hide();controller.abort();tip.remove();};
}
