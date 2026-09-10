import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../dist/server/main.js';

const phase=process.argv[2]??'create';
assert.ok(['create','deliver','serve'].includes(phase));
const evidencePath='.data/doc-complex-evidence.json';
let evidence=phase==='create'?{workspace:await mkdtemp(resolve('.data/doc-complex-'))}:JSON.parse(await readFile(evidencePath,'utf8'));
if(phase==='create')await writeFile(evidencePath,JSON.stringify(evidence,null,2),{flag:'wx'});
const app=await startServer({workspace:evidence.workspace,port:phase==='serve'?9082:0});
const save=()=>writeFile(evidencePath,JSON.stringify(evidence,null,2));
const call=async(path,body)=>{
 const response=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;
};
try{
 if(phase==='create'){
  const {fileId}=await call('/files',{file:'quarterly-report.univer'});
  const {worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
  const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'doc',name:'季度报告 · 分页与图表'});
  evidence.target={fileId,unitId,worktreeId,branch:'worktree'};await save();
  evidence.edit=await call('/content',{target:evidence.target,action:'execute',mode:'write',code:`
if(!doc.isTraditional())throw Error('Traditional pagination is required');
if(!doc.getSection(0).setPageSetup({pageSize:{width:794,height:1123},marginTop:80,marginBottom:80,marginLeft:80,marginRight:80}))throw Error('Page setup failed');
const header=doc.ensurePageHeader(),footer=doc.ensurePageFooter();
doc.insertText(0,'UNIVER OFFICE | 季度经营报告',header);
doc.insertText(0,'内部审阅稿 · 2026 年第三季度',footer);
doc.setHeaderFooterOptions({marginHeader:32,marginFooter:32});
doc.appendParagraph('季度经营报告').getTextRange().setTextStyle({fs:26,bl:1,cl:{rgb:'#245442'}});
doc.appendParagraph('2026 年第三季度 | 销售分析与下一步计划').getTextRange().setTextStyle({fs:13,cl:{rgb:'#596c63'}});
doc.appendParagraph('一、季度表现').getTextRange().setTextStyle({fs:18,bl:1});
doc.appendParagraph('本季度销售额逐月增长。7 月为 120 万元，8 月为 180 万元，9 月为 240 万元；季度合计 540 万元。');
const chartOffset=doc.getBody().dataStream.length-2;
const chart=doc.newChart(api.Enum.ChartTypeString.Column).setSource([['月份','销售额（万元）'],['7 月',120],['8 月',180],['9 月',240]]).setTitle('第三季度月度销售额').setPosition({kind:api.Enum.DocsChartInsertAnchorKind.BodyOffset,offset:chartOffset}).setInline().setSize(580,300).build();
if(!await doc.insertChart(chart))throw Error('Chart insertion failed');
const chapter=doc.appendParagraph('二、执行计划');chapter.getTextRange().setTextStyle({fs:18,bl:1});
if(!chapter.setStyle({pageBreakBefore:api.Enum.BooleanNumber.TRUE,keepNext:api.Enum.BooleanNumber.TRUE}))throw Error('Page break failed');
doc.appendParagraph('下表列出下一季度的三个重点事项。图表、页眉页脚与这张表应在截图、PDF 和 DOCX 中保持可读。');
const table=doc.insertTableFromData([['重点事项','负责人','目标'],['客户回访','林','完成 30 次访谈'],['报表自动化','周','覆盖 3 个部门'],['文档整理','陈','建立统一模板']],{headerRowCount:1,width:580,columnWidths:[200,100,280]});
if(!table||!table.setTableBorder({preset:api.Enum.DocsTableBorderPreset.All,color:'#9cafaa',width:1}))throw Error('Table creation failed');
doc.getTextRange(0,doc.getBody().dataStream.length-1).setTextStyle({ff:'Arial Unicode MS'});
for(const segment of [header,footer])doc.getTextRange(0,doc.getBody(segment).dataStream.length-1,segment).setTextStyle({ff:'Arial Unicode MS',fs:10,cl:{rgb:'#596c63'}});
return {header,footer,chartCount:doc.getCharts().length};
`});await save();assert.equal(evidence.edit.commit,'confirmed');
 }
 if(phase!=='serve'){
  evidence.snapshot=await call('/content',{target:evidence.target,action:'snapshot'});await save();
  assert.equal(evidence.snapshot.unitData.documentStyle.documentFlavor,1);
  assert.ok(JSON.stringify(evidence.snapshot.unitData).includes('季度经营报告'));
  if(!evidence.docx){evidence.docx=await call('/delivery',{target:evidence.target,action:'export',output:'quarterly-report.docx'});await save();}
  if(!evidence.screenshot){const result=await call('/delivery',{target:evidence.target,action:'screenshot',output:'quarterly-report.png'});evidence.screenshot={...result,images:result.images.map(({data,...image})=>image)};await save();}
  if(!evidence.pdf){evidence.pdf=await call('/delivery',{target:evidence.target,action:'pdf',output:'quarterly-report.pdf'});await save();}
  console.log(JSON.stringify({workspace:evidence.workspace,target:evidence.target,commit:evidence.edit?.commit,images:evidence.screenshot?.images,docx:evidence.docx,pdf:evidence.pdf},null,2));
 }else{
  const url=new URL(app.launchUrl);for(const [key,value]of Object.entries({file:evidence.target.fileId,unit:evidence.target.unitId,worktree:evidence.target.worktreeId}))url.searchParams.set(key,value);
  await writeFile('.data/doc-complex-runtime.json',JSON.stringify({launchUrl:url.href,origin:app.origin,agentToken:app.agentToken,target:evidence.target}),{mode:0o600});
  console.log(JSON.stringify({pid:process.pid,origin:app.origin}));
  await new Promise(resolve=>process.once('SIGTERM',resolve));
 }
}finally{await app.close();}
