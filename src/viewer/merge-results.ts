import type {WorktreeData} from '@univerjs-pro/collaboration-worktree-service';
import type {UnitRecord} from '../shared/contracts.js';

/** Successful merges return to trunk; only unresolved work needs an entry here. */
export function renderMergeResults(container:HTMLElement,worktree:WorktreeData|undefined,units:UnitRecord[]) {
  container.replaceChildren();
  const unresolved=worktree?.units.filter(unit=>!unit.mergeResult||['failed','conflict'].includes(unit.mergeResult.status))??[];
  container.hidden=!worktree?.units.some(unit=>unit.mergeResult)||worktree.status==='merged'||!unresolved.length;
  if(container.hidden)return;
  const message=document.createElement('span');message.textContent=`${unresolved.length} 项修改未合入`;
  const details=document.createElement('button');details.textContent='查看原因';
  details.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='office-dialog merge-issues-dialog';dialog.setAttribute('aria-label','未合入的修改');
    const title=document.createElement('h2');title.textContent='部分修改未合入';
    const list=document.createElement('ul');
    for(const unit of unresolved){
      const row=document.createElement('li'),result=unit.mergeResult;
      const name=units.find(record=>record.unitId===unit.unitID)?.name??unit.unitID;
      row.textContent=`${name}：${result?.status==='conflict'?'内容冲突':result?.status==='failed'?'合入失败':'尚未完成'}`;
      if(result?.status==='failed'||result?.status==='conflict')row.append(` · ${result.error.message}`);
      list.append(row);
    }
    const note=document.createElement('p');note.textContent='已合入的内容会保留。处理未完成项后可重试，已成功的内容不会重复合入。';
    const close=document.createElement('button');close.textContent='知道了';
    close.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
    dialog.append(title,list,note,close);document.body.append(dialog);dialog.showModal();
  };
  container.append(message,details);
}
