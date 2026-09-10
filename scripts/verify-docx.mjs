import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const runtime=JSON.parse(await readFile('.data/runtime.json','utf8'));
const font=process.env.OFFICE_TEST_DOC_FONT??'Arial Unicode MS';
async function call(path,body){
  const response=await fetch(runtime.origin+'/api'+path,{method:'POST',headers:{Authorization:`Bearer ${runtime.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;
}
const run=Date.now(),evidence={run,font};
const file=await call('/files',{file:`Doc格式验证-${run}.univer`});
const draft=await call(`/files/${file.fileId}/worktrees`,{});
const unit=await call(`/files/${file.fileId}/units`,{worktreeId:draft.worktreeID,kind:'doc',name:'文档导出验证'});
const target={fileId:file.fileId,unitId:unit.unitId,worktreeId:draft.worktreeID,branch:'worktree'};
evidence.target=target;
// Persist the target before any write, so a failed run can be inspected safely.
await writeFile('.data/docx-verification.json',JSON.stringify(evidence,null,2));
evidence.edit=await call('/content',{target,action:'execute',mode:'write',code:`
doc.appendParagraph('WorkBuddy 文档导出验证').getTextRange().setTextStyle({fs:24,bl:1,cl:{rgb:'#367d67'}});
doc.appendParagraph('中文内容、字体与表格边框均通过 Office SDK 显式设置。');
doc.appendParagraph('验证清单').getTextRange().setTextStyle({fs:17,bl:1});
const table=doc.insertTableFromData([['验证项目','验收方式'],['中文与英文','独立阅读器检查字符'],['表格边框','检查实际边框与列宽'],['草稿持久化','确认提交后重新加载']],{headerRowCount:1,width:500,columnWidths:[200,300]});
if(!table)throw Error('Table creation failed');
if(!table.setTableBorder({preset:api.Enum.DocsTableBorderPreset.All,color:'#9cafaa',width:1}))throw Error('Border failed');
doc.getTextRange(0,doc.getBody().dataStream.length-1).setTextStyle({ff:${JSON.stringify(font)}});
return true;`});
await writeFile('.data/docx-verification.json',JSON.stringify(evidence,null,2));
assert.equal(evidence.edit.commit,'confirmed');
evidence.snapshot=await call('/content',{target,action:'snapshot'});
assert.ok(evidence.snapshot.unitData.body.dataStream.includes('独立阅读器检查字符'));
assert.ok(evidence.snapshot.unitData.body.textRuns.some(r=>r.ts?.ff===font));
const savedTable=Object.values(evidence.snapshot.unitData.tableSource)[0];
assert.equal(savedTable.size.width.v,500);
assert.deepEqual(savedTable.tableColumns.map(column=>column.size.width.v),[200,300]);
evidence.export=await call('/delivery',{target,action:'export',output:`docx-verified-${run}.docx`});
const screenshot=await call('/delivery',{target,action:'screenshot',output:`docx-verified-${run}.png`});
evidence.screenshot={...screenshot,images:screenshot.images.map(({data,...image})=>image)};
evidence.ready=await call(`/files/${file.fileId}/review/${draft.worktreeID}`,{action:'ready'});
await writeFile('.data/docx-verification.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify({run,font,target,export:evidence.export,screenshot:evidence.screenshot.images,commit:evidence.edit.commit},null,2));
