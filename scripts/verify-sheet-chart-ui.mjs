import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';

// Reuse the closed feature fixture so charts, validation, and formatting coexist.
const {workspace,target}=JSON.parse(await readFile('.data/sheet-features-target.json','utf8'));
const app=await startServer({workspace,port:9082});
const call=async(path,body)=>{
 const response=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
};
try{
 const initial=await call('/content',{target,action:'execute',mode:'read',code:'return workbook.getActiveSheet().getCharts().map(c=>c.getId());'});
 assert.equal(initial.value.length,0,'Existing chart fixture: inspect evidence before retrying creation');
 const edit=await call('/content',{target,action:'execute',mode:'write',code:`
 const sheet=workbook.getActiveSheet();
 const info=sheet.newChart(api.Enum.ChartTypeString.Column)
  .setSource({range:'A3:B6',orientation:api.Enum.ChartSourceOrientation.Columns})
  .setPosition('F3').setSize(600,340).setCategoryField(0).setValueFields([1])
  .setTitle('产品销售额').setYAxis({min:0}).build();
 const chart=await sheet.insertChart(info);return {id:chart.getId(),info:chart.getInfo()};
 `});
 assert.equal(edit.commit,'confirmed');
 await writeFile('.data/sheet-chart-evidence.json',JSON.stringify({workspace,target,edit},null,2));
 const read=await call('/content',{target,action:'execute',mode:'read',code:'const s=workbook.getActiveSheet();return {charts:s.getCharts().map(c=>({id:c.getId(),info:c.getInfo()})),rules:s.getConditionalFormattingRules().length,values:s.getRange("A3:D7").getRawValues()};'});
 assert.equal(read.value.charts.length,1);assert.equal(read.value.charts[0].id,edit.value.id);assert.equal(read.value.rules,1);
 const exported=await call('/delivery',{target,action:'export',output:'sheet-chart.xlsx'});
 const capture=await call('/delivery',{target,action:'screenshot',output:'sheet-chart.png'});
 assert.ok(capture.images.length);
 const url=new URL(app.launchUrl);url.searchParams.set('file',target.fileId);url.searchParams.set('unit',target.unitId);url.searchParams.set('worktree',target.worktreeId);
 await writeFile('.data/sheet-chart-runtime.json',JSON.stringify({origin:app.origin,launchUrl:url.href,agentToken:app.agentToken,workspace,target}),{mode:0o600});
 await writeFile('.data/sheet-chart-evidence.json',JSON.stringify({workspace,target,edit,read,exported,capture:{images:capture.images.map(({data,...rest})=>rest)}},null,2));
 console.log(JSON.stringify({pid:process.pid,workspace,chartId:edit.value.id,phase:'UI ready'}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
