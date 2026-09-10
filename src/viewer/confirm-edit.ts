/** A user gesture is required before asking the server for an edit grant. */
export function confirmEdit(name:string){return confirmAction('确认开启编辑？',`将编辑“${name}”已合入的主线版本，修改会实时保存。`,'确认编辑');}
export function confirmMerge(name:string){return confirmAction('确认合入当前版本？',`将合入“${name}”所在草稿的变更。合入成功后才允许编辑主线版本。`,'确认合入');}
export function confirmDiscard(name:string){return confirmAction('丢弃这处修改？',`将丢弃“${name}”所在草稿的修改，当前版本保持不变。`,'确认丢弃');}
export function confirmReady(name:string){return confirmAction('提交确认？',`“${name}”所在草稿将进入待确认状态，之后可以合入或丢弃。`,'提交确认');}
function confirmAction(heading:string,copy:string,label:string):Promise<boolean>{
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='office-dialog';dialog.id='confirm-edit-dialog';dialog.setAttribute('aria-labelledby','confirm-edit-title');
    const title=document.createElement('h2');title.id='confirm-edit-title';title.textContent=heading;
    const description=document.createElement('p');description.textContent=copy;
    const actions=document.createElement('div');actions.className='dialog-actions';
    const cancel=document.createElement('button');cancel.textContent='取消';cancel.autofocus=true;
    const confirm=document.createElement('button');confirm.textContent=label;confirm.className='primary';
    const finish=(accepted:boolean)=>{dialog.close();dialog.remove();resolve(accepted);};
    cancel.onclick=()=>finish(false);confirm.onclick=()=>finish(true);
    dialog.oncancel=event=>{event.preventDefault();finish(false);};
    actions.append(cancel,confirm);dialog.append(title,description,actions);document.body.append(dialog);dialog.showModal();
  });
}
