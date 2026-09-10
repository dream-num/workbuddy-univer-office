import {CollabError} from '@univerjs-pro/collaboration-service';
export async function partialMergeFixture(app){
  const file=await app.office.open('partial-merge.univer',true),fileId=file.catalog.fileId;
  const draft=await app.office.createWorktree(fileId),units=[];
  for(const name of ['销售明细：可合入','费用明细：首次提交失败'])units.push(await app.office.createUnit(fileId,draft.worktreeID,'sheet',name));
  let blocked=true;
  const rejection=file.service.use('createUnit',async(ctx,next)=>{
    if(blocked&&ctx.request.snapshot.unitID===units[1].unitId){
      blocked=false;
      throw new CollabError('PERMISSION_DENIED','验收注入：该内容首次提交被拒绝，请重新审阅后重试');
    }
    await next();
  });
  await app.office.action(fileId,draft.worktreeID,'ready','agent');
  return {fileId,worktreeId:draft.worktreeID,units,rejection};
}
