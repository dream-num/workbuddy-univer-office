import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {compileSvgToFacade,wrapSlideScript} from '@univer-cli/svg-facade';
const {origin,agentToken}=JSON.parse(await readFile('.data/runtime.json','utf8'));
async function call(path,body){const response=await fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${agentToken}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));return result;}
const run=Date.now(),evidence={run,products:[]};
const {fileId}=await call('/files',{file:`Office五类内容验证-${run}.univer`});
evidence.fileId=fileId;
const draft=await call(`/files/${fileId}/worktrees`,{});evidence.worktreeId=draft.worktreeID;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#f3f7f5"/><rect x="0" y="0" width="1280" height="200" fill="#367d67"/><text x="70" y="100" fill="#ffffff" font-size="44" font-family="Arial">Office SDK · 创作与审阅</text><text x="72" y="156" fill="#def1e6" font-size="23" font-family="Arial">WorkBuddy Univer Office / SDK native slide verification</text><rect x="70" y="265" width="350" height="260" rx="16" fill="#ffffff"/><rect x="465" y="265" width="350" height="260" rx="16" fill="#ffffff"/><rect x="860" y="265" width="350" height="260" rx="16" fill="#ffffff"/><text x="100" y="326" font-size="32" fill="#245442">01 创建草稿</text><text x="100" y="385" font-size="23" fill="#53685e">独立编辑，主线保持稳定</text><text x="495" y="326" font-size="32" fill="#245442">02 检查内容</text><text x="495" y="385" font-size="23" fill="#53685e">回读、截图、布局检查</text><text x="890" y="326" font-size="32" fill="#245442">03 人工审阅</text><text x="890" y="385" font-size="23" fill="#53685e">确认后合入当前版本</text><text x="72" y="650" font-size="18" fill="#697d72">验证样例 · SVG 编译为可编辑的原生 Slide 元素</text></svg>`;
const compiled=await compileSvgToFacade(svg);
const fixtures=[
 {kind:'doc',name:'实施说明与审阅清单',query:'document',extension:'docx',code:`
const title=doc.appendParagraph('WorkBuddy Univer Office 实施说明');title.getTextRange().setTextStyle({fs:24,bl:1,cl:{rgb:'#367d67'}});
doc.appendParagraph('本文件由 Office SDK 在独立草稿中生成，用于验证中文内容、富文本和表格的保存与交付。').getTextRange().setTextStyle({fs:12});
doc.appendParagraph('一、创作流程').getTextRange().setTextStyle({fs:17,bl:1});
doc.appendParagraph('创建草稿 → Agent 编辑 → 回读与截图 → 用户审阅 → 合入当前版本。');
doc.appendParagraph('二、验证范围').getTextRange().setTextStyle({fs:17,bl:1});
const table=doc.insertTableFromData([['验证项','结果'],['中文段落与格式','已写入'],['独立草稿持久化','等待回读检查'],['导出与截图','等待渲染检查']],{headerRowCount:1});if(!table)throw new Error('Table creation failed');
return doc.getBody();`,read:`return doc.getBody();`,expected:'实施说明'},
 {kind:'slide',name:'Office 创作与审阅流程',query:'presentation',extension:'pptx',code:wrapSlideScript(compiled.code,{page:1,mode:'replace',...compiled.viewport}),read:`return presentation.save();`,expected:'创作'},
 {kind:'base',name:'功能验证任务库',query:'base',code:`
const table=base.insertTable('验证任务',{primaryFieldName:'任务'});const status=table.addField('状态',api.Enum.BaseFieldType.Text);const count=table.addField('检查数',api.Enum.BaseFieldType.Number);const owner=table.addField('负责人',api.Enum.BaseFieldType.Text);
table.addRecords([['文档与表格','检查中',4,'SDK'],['演示文稿','检查中',3,'SDK'],['白板与连接线','检查中',3,'SDK']].map(row=>({values:{[table.getPrimaryFieldId()]:row[0],[status.getId()]:row[1],[count.getId()]:row[2],[owner.getId()]:row[3]}})));
return table.getRecords().map(r=>r.getValues());`,read:`return base.getTables().map(t=>({name:t.getName(),records:t.getRecords().map(r=>r.getValues())}));`,expected:'白板与连接线'},
 {kind:'board',name:'Office 草稿协作流程图',query:'board',code:`
board.insertText({left:60,top:35,width:950,height:70,text:'Office 草稿协作流程',textStyle:{fontSize:34,bold:true,color:'#245442'}});
const nodes=[];for(const [i,text]of ['创建草稿','Agent 编辑','检查与审阅','合入主线'].entries()){const shape=board.insertShape({shapeType:api.Enum.ShapeTypeEnum.RoundRect,transform:{left:60+i*260,top:200,width:210,height:115}});if(!shape)throw new Error('Shape creation failed');shape.setSolidFill(i===3?'#367d67':'#e3f0e8');shape.getText().setText(text).setFontSize(24).setColor(i===3?'#ffffff':'#245442');nodes.push(shape.getId());}
for(let i=0;i<3;i++){if(!board.insertConnector({fromElementId:nodes[i],toElementId:nodes[i+1],routing:'orthogonal',style:{endMarker:{type:'filledTriangle',size:'md'}}}))throw new Error('Connector creation failed');}
board.insertText({left:60,top:400,width:950,height:80,text:'确认写入后回读验证；只有用户审阅操作才能合入。',textStyle:{fontSize:22,color:'#5b7165'}});
return true;`,read:`return JSON.parse(JSON.stringify(board.save()));`,expected:'合入主线'},
];
for(const fixture of fixtures){
 const record={kind:fixture.kind,name:fixture.name};evidence.products.push(record);
 try{
  const unit=await call(`/files/${fileId}/units`,{worktreeId:draft.worktreeID,kind:fixture.kind,name:fixture.name});
  record.target={fileId,unitId:unit.unitId,branch:'worktree',worktreeId:draft.worktreeID};
  record.edit=await call('/content',{target:record.target,action:'execute',mode:'write',code:fixture.code});assert.equal(record.edit.outcome,'completed');assert.equal(record.edit.commit,'confirmed');
  record.read=await call('/content',{target:record.target,action:'execute',mode:'read',code:fixture.read});assert.ok(JSON.stringify(record.read.value).includes(fixture.expected),`${fixture.kind} content missing on reload`);
  record.inspect=await call('/content',{target:record.target,action:'inspect',query:{kind:fixture.query}});
  const screenshot=await call('/delivery',{target:record.target,action:'screenshot',output:`verify-${fixture.kind}-${run}.png`});
  record.screenshot={...screenshot,images:screenshot.images.map(({data,...image})=>image)};assert.ok(record.screenshot.images.length>0);
  if(fixture.extension)record.export=await call('/delivery',{target:record.target,action:'export',output:`verify-${fixture.kind}-${run}.${fixture.extension}`});
  if(fixture.kind!=='base')record.pdf=await call('/delivery',{target:record.target,action:'pdf',output:`verify-${fixture.kind}-${run}.pdf`});
  if(fixture.kind==='slide')record.lint=await call('/delivery',{target:record.target,action:'lint'});
  console.log(JSON.stringify({kind:fixture.kind,revision:record.edit.revision,images:record.screenshot.images.map(i=>i.output),pdf:record.pdf?.pageCount,export:record.export?.output}));
 }catch(error){record.error=String(error);console.error(fixture.kind,record.error);}
 await writeFile('.data/products-evidence.json',JSON.stringify(evidence,null,2));
}
if(evidence.products.every(p=>!p.error))evidence.ready=await call(`/files/${fileId}/review/${draft.worktreeID}`,{action:'ready'});
await writeFile('.data/products-evidence.json',JSON.stringify(evidence,null,2));
assert.ok(evidence.products.every(p=>!p.error),'One or more product verifications failed; inspect saved evidence before retrying any writes.');
