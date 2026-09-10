import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';

// Reuse the closed fixture to verify pivot, chart, formatting and validation together.
const {workspace,target}=JSON.parse(await readFile('.data/sheet-features-target.json','utf8'));
const app=await startServer({workspace,port:9082});
const call=async(path,body)=>{
 const response=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
};
try{
 const initial=await call('/content',{target,action:'execute',mode:'read',code:'return Boolean(workbook.getActiveSheet().getPivotTableByCell(19,0));'});
 assert.equal(initial.value,false,'Existing pivot: inspect evidence before retrying creation');
 const edit=await call('/content',{target,action:'execute',mode:'write',code:`
 const s=workbook.getActiveSheet();
 s.getRange('A12:C18').setValues([['地区','产品','金额'],['东区','协作',100],['东区','分析',200],['东区','文档',300],['西区','协作',400],['西区','分析',500],['西区','文档',600]]);
 s.getRange('A12:C12').setBackground('#e3f0e8').setFontWeight('bold');
 const unitId=workbook.getId(),subUnitId=s.getSheetId();
 const pivot=await workbook.addPivotTable({unitId,subUnitId,sheetName:s.getSheetName(),range:s.getRange('A12:C18').getRange()},api.Enum.PositionTypeEnum.Existing,{unitId,subUnitId,row:19,col:0});
 if(!pivot)throw Error('Pivot creation failed');
 if(!await pivot.addField(0,api.Enum.PivotTableFiledAreaEnum.Row,0))throw Error('Row field failed');
 if(!await pivot.addField(2,api.Enum.PivotTableFiledAreaEnum.Value,0))throw Error('Value field failed');
 return {id:pivot.getId(),config:pivot.getConfig()};
 `});
 assert.equal(edit.commit,'confirmed');
 await writeFile('.data/sheet-pivot-evidence.json',JSON.stringify({workspace,target,edit},null,2));
 const read=await call('/content',{target,action:'execute',mode:'read',code:`const s=workbook.getActiveSheet();const p=workbook.getPivotTableById(${JSON.stringify(edit.value.id)});return {id:p?.getId(),config:p?.getConfig(),values:s.getRange('A20:C25').getRawValues(),charts:s.getCharts().length,rules:s.getConditionalFormattingRules().length};`});
 assert.equal(read.value.id,edit.value.id);assert.equal(read.value.charts,1);assert.equal(read.value.rules,1);
 const exported=await call('/delivery',{target,action:'export',output:'sheet-pivot.xlsx'});
 const capture=await call('/delivery',{target,action:'screenshot',output:'sheet-pivot.png'});
 assert.ok(capture.images.length);
 const url=new URL(app.launchUrl);url.searchParams.set('file',target.fileId);url.searchParams.set('unit',target.unitId);url.searchParams.set('worktree',target.worktreeId);
 await writeFile('.data/sheet-pivot-runtime.json',JSON.stringify({origin:app.origin,launchUrl:url.href,agentToken:app.agentToken,workspace,target}),{mode:0o600});
 await writeFile('.data/sheet-pivot-evidence.json',JSON.stringify({workspace,target,edit,read,exported,capture:{images:capture.images.map(({data,...rest})=>rest)}},null,2));
 console.log(JSON.stringify({pid:process.pid,workspace,pivotId:edit.value.id,phase:'UI ready'}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
