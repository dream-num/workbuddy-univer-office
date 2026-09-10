import {readFile,writeFile} from 'node:fs/promises';
const {origin,agentToken}=JSON.parse(await readFile('.data/runtime.json','utf8'));
async function call(path,body){const r=await fetch(origin+'/api'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${agentToken}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const x=await r.json();if(!r.ok)throw new Error(JSON.stringify(x));return x;}
const {fileId}=await call('/files',{file:`销售分析-${Date.now()}.univer`});
const worktree=await call(`/files/${fileId}/worktrees`,{});
const unit=await call(`/files/${fileId}/units`,{worktreeId:worktree.worktreeID,kind:'sheet',name:'2026 第三季度销售分析'});
const target={fileId,unitId:unit.unitId,branch:'worktree',worktreeId:worktree.worktreeID};
await writeFile('.data/smoke-target.json',JSON.stringify(target,null,2));
console.log('Created draft Sheet',target);
const edited=await call('/content',{action:'execute',mode:'write',target,code:`const sheet=workbook.getActiveSheet(); sheet.getRange('A1:F1').merge(); sheet.getRange('A1').setValue('2026 第三季度 · 销售经营分析'); sheet.getRange('A1:F1').setBackground('#19836b').setFontColor('#ffffff').setFontSize(18); sheet.setRowHeight(0,48); sheet.getRange('A3:F8').setValues([['产品线','7月销售额','8月销售额','9月销售额','季度合计','增长率'],['企业协作',128000,146000,172000,'=SUM(B4:D4)','=D4/B4-1'],['数据分析',86000,95000,118000,'=SUM(B5:D5)','=D5/B5-1'],['文档服务',64000,73000,89000,'=SUM(B6:D6)','=D6/B6-1'],['开发平台',92000,108000,139000,'=SUM(B7:D7)','=D7/B7-1'],['合计','=SUM(B4:B7)','=SUM(C4:C7)','=SUM(D4:D7)','=SUM(E4:E7)','=D8/B8-1']]);sheet.getRange('A3:F3').setBackground('#e5f2ec').setFontWeight('bold');sheet.getRange('A8:F8').setBackground('#edf5f1').setFontWeight('bold');sheet.setColumnWidth(0,160);for(let c=1;c<6;c++)sheet.setColumnWidth(c,135);sheet.getRange('B4:E8').setNumberFormat('#,##0');sheet.getRange('F4:F8').setNumberFormat('0.0%');sheet.getRange('A10:F10').merge();sheet.getRange('A10').setValue('审阅说明：公式计算、独立草稿、人工合入；数据为测试样例。');return sheet.getRange('A3:F8').getValues();`});
console.log('Edit result',JSON.stringify(edited));
const inspected=await call('/content',{action:'execute',mode:'read',target,code:`return workbook.getActiveSheet().getRange('A3:F8').getValues();`});
console.log('Readback',JSON.stringify(inspected));
const ready=await call(`/files/${fileId}/review/${target.worktreeId}`,{action:'ready'});console.log('Ready',JSON.stringify(ready));
const denied=await call(`/files/${fileId}/review/${target.worktreeId}`,{action:'merge',approved:true});console.log('Agent merge result',JSON.stringify(denied));
await writeFile('.data/smoke-evidence.json',JSON.stringify({target,edited,inspected,ready,denied},null,2));
