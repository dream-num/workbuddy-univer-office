import {readFile,writeFile} from 'node:fs/promises';
const {origin,agentToken}=JSON.parse(await readFile('.data/runtime.json','utf8'));
const {fileId,unitId}=JSON.parse(await readFile('.data/smoke-target.json','utf8'));
async function call(path,body){const r=await fetch(origin+'/api'+path,{method:'POST',headers:{Authorization:`Bearer ${agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw new Error(JSON.stringify(x));return x;}
const draft=await call(`/files/${fileId}/worktrees`,{unitIds:[unitId]});
const target={fileId,unitId,branch:'worktree',worktreeId:draft.worktreeID};
await call('/content',{target,action:'execute',mode:'write',code:`workbook.getActiveSheet().getRange('B4').setValue(148000);workbook.getActiveSheet().getRange('A10').setValue('审阅说明：7月企业协作收入新增确认 20,000；公式自动重算。');return true;`});
await call(`/files/${fileId}/review/${draft.worktreeID}`,{action:'ready'});
const comparison=await call('/comparisons',{target});
await writeFile('.data/comparison-evidence.json',JSON.stringify(comparison,null,2));
await writeFile('.data/comparison-target.json',JSON.stringify(target,null,2));
console.log(JSON.stringify({comparisonId:comparison.comparisonId,leftRevision:comparison.left.revision,rightRevision:comparison.right.revision,items:comparison.result.items.map(i=>({type:i.entityType,name:i.displayName,kind:i.kind}))}));
