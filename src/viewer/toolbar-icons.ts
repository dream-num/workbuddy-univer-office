const paths={
  plus:'<path d="M12 5v14M5 12h14"/>',
  pip:'<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5m10.5-4a8 8 0 0 0-13.3-3M4.5 16a8 8 0 0 0 13.3 3"/>',
  panelOpen:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m5-13 4 4-4 4"/>',
  panelClose:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m8-13-4 4 4 4"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  shrink:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>',
  moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  fit:'<rect x="5" y="7" width="14" height="10" rx="1"/><path d="M7 3H3v4m14-4h4v4M3 17v4h4m14-4v4h-4"/>',
  history:'<path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-4v5l3 2"/>',
  restore:'<path d="M3 10h11a7 7 0 0 1 0 14M3 10l5-5m-5 5 5 5" transform="translate(0 -2)"/>',
};
export type ToolbarIcon=keyof typeof paths;
export function setToolbarIcon(button:HTMLButtonElement,icon:ToolbarIcon,label:string){
  button.classList.add('toolbar-icon');button.dataset.tooltip=label;button.removeAttribute('title');button.setAttribute('aria-label',label);
  button.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[icon]}</svg>`;
}
