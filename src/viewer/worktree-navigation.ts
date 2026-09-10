import type {WorktreeData} from '@univerjs-pro/collaboration-worktree-service';
import type {Root} from 'react-dom/client';
import {renderProductIcon,productNames} from './product-icons.js';
import type {UnitRecord} from '../shared/contracts.js';

const iconRoots=new WeakMap<HTMLElement,Root[]>();
export function renderWorktreeNavigation(host:HTMLElement,worktrees:WorktreeData[],units:UnitRecord[],selected:string,selectedUnit:string,open:(worktreeId:string,unitId:string,reviewId?:string)=>Promise<void>){
  const expanded=host.querySelector<HTMLDetailsElement>('.merged-worktrees')?.open??false;
  for(const root of iconRoots.get(host)??[])root.unmount();
  const roots:Root[]=[];iconRoots.set(host,roots);
  host.replaceChildren();
  const iconFor=(button:HTMLButtonElement,unit?:UnitRecord)=>{
    if(!unit)return;
    const icon=document.createElement('span');roots.push(renderProductIcon(icon,unit.kind));button.prepend(icon);
    button.setAttribute('aria-label',`${productNames[unit.kind]} · ${button.textContent}`);
  };
  const pending=worktrees.filter(w=>['draft','ready','merging'].includes(w.status));
  const name=(w:WorktreeData)=>`${units.find(u=>u.unitId===w.units[0]?.unitID)?.name??'修改'}${w.units.length>1?` 等 ${w.units.length} 项`:''}`;
  const makeButton=(label:string,action:()=>Promise<void>)=>{
    const button=document.createElement('button');const text=document.createElement('span');text.className='worktree-title';text.textContent=label;button.append(text);button.title=label;
    button.onclick=()=>{void action();};return button;
  };
  for(const draft of pending){
    const state=draft.status==='ready'?'待确认':draft.status==='draft'?'修改中':'待处理';
    const entry=makeButton(`${name(draft)} · ${state}`,()=>open(draft.worktreeID,draft.units[0]?.unitID??''));
    iconFor(entry,units.find(u=>u.unitId===draft.units[0]?.unitID));
    entry.querySelector('.worktree-title')!.textContent=name(draft);
    const badge=document.createElement('span');badge.className='worktree-state';badge.dataset.state=draft.status;badge.textContent=state;entry.append(badge);
    entry.title+=`\n修改编号：${draft.worktreeID.slice(0,8)}`;
    entry.classList.toggle('selected',draft.worktreeID===selected);
    entry.setAttribute('aria-current',draft.worktreeID===selected?'true':'false');
    host.append(entry);
    if(draft.worktreeID===selected){
      const contents=document.createElement('div');contents.className='worktree-contents';
      for(const changed of draft.units){
        const unit=units.find(u=>u.unitId===changed.unitID);
        const item=makeButton(`${unit?.name??changed.unitID}${changed.removed?' · 待移除':''}`,()=>open(draft.worktreeID,changed.unitID));
        iconFor(item,unit);
        item.classList.toggle('selected',changed.unitID===selectedUnit);
        item.setAttribute('aria-current',String(changed.unitID===selectedUnit));contents.append(item);
      }
      host.append(contents);
    }
  }
  if(!pending.length){const empty=document.createElement('p');empty.className='worktrees-empty';empty.textContent='暂无待合入修改';host.append(empty);}
  const merged=worktrees.filter(w=>w.status==='merged').reverse();
  if(!merged.length)return;
  const history=document.createElement('details');history.className='merged-worktrees';history.open=expanded;
  const summary=document.createElement('summary');summary.textContent=`已合入记录 · ${merged.length}`;history.append(summary);
  for(const draft of merged){
    const group=document.createElement('section');group.className='merged-worktree';
    const label=document.createElement('div');label.className='merged-worktree-name';label.textContent=name(draft);group.append(label);
    for(const changed of draft.units){
      const unit=units.find(u=>u.unitId===changed.unitID);
      const available=Boolean(unit&&!unit.removed&&!unit.worktreeId&&changed.mergeResult?.status!=='removed');
      const entry=makeButton(`${available?'打开内容':'已移除'} · ${unit?.name??changed.unitID}`,()=>open('',changed.unitID,draft.worktreeID));
      iconFor(entry,unit);
      entry.disabled=!available;if(!available)entry.dataset.unavailable='true';group.append(entry);
    }
    history.append(group);
  }
  host.append(history);
}
