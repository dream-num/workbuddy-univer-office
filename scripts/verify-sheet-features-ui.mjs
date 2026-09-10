import {mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';

const workspace=await mkdtemp(resolve('.data/sheet-features-'));
const app=await startServer({workspace,port:9082});
const call=async(path,body)=>{
 const response=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
};
try{
 const {fileId}=await call('/files',{file:'sheet-features.univer'});
 const {worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
 const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'sheet',name:'条件格式与数据校验'});
 const target={fileId,unitId,worktreeId,branch:'worktree'};
 await writeFile('.data/sheet-features-target.json',JSON.stringify({workspace,target},null,2));
 const edit=await call('/content',{target,action:'execute',mode:'write',code:`
 const sheet=workbook.getActiveSheet();
 sheet.getRange('A1:D1').merge().setValue('销售校验 · 条件格式与下拉选项').setBackground('#245442').setFontColor('#ffffff').setFontSize(18);
 sheet.setRowHeight(0,44);
 sheet.getRange('A3:D7').setValues([['产品','销售额','状态','含税金额'],['协作',800,'待审阅','=B4*1.1'],['分析',1600,'已检查','=B5*1.1'],['文档',2400,'待审阅','=B6*1.1'],['合计','=SUM(B4:B6)','', '=SUM(D4:D6)']]);
 sheet.getRange('A3:D3').setBackground('#e3f0e8').setFontWeight('bold');
 sheet.getRange('A7:D7').setFontWeight('bold');
 for(let c=0;c<4;c++)sheet.setColumnWidth(c,180);
 sheet.getRange('B4:B7').setNumberFormat('#,##0');sheet.getRange('D4:D7').setNumberFormat('#,##0.00');
 const conditional=sheet.newConditionalFormattingRule().whenNumberGreaterThan(1000).setRanges([sheet.getRange('B4:B6').getRange()]).setBackground('#bbf7d0').setFontColor('#14532d').build();
 sheet.addConditionalFormattingRule(conditional);
 sheet.getRange('C4:C6').setDataValidation(api.newDataValidation().requireValueInList(['待审阅','已检查'],false,true).build());
 sheet.getRange('A9:D9').merge().setValue('绿色：销售额 > 1,000；状态列提供下拉选择。');
 return true;
 `});
 assert.equal(edit.commit,'confirmed');
 const read=await call('/content',{target,action:'execute',mode:'read',code:`const s=workbook.getActiveSheet();return {values:s.getRange('A3:D7').getRawValues(),conditional:s.getConditionalFormattingRules(),validation:s.getRange('C4').getDataValidation()?.getCriteriaValues()};`});
 assert.equal(read.value.conditional.length,1);
 assert.equal(read.value.values[4][1],4800);assert.equal(read.value.values[4][3],5280);
 assert.ok(JSON.stringify(read.value.validation).includes('待审阅'));
 const baseline=await call('/content',{target,action:'snapshot'});
 const exported=await call('/delivery',{target,action:'export',output:'sheet-features.xlsx'});
 const screenshot=await call('/delivery',{target,action:'screenshot',output:'sheet-features.png'});
 assert.ok(screenshot.images.length>0);
 const launch=new URL(app.launchUrl);launch.searchParams.set('file',fileId);launch.searchParams.set('unit',unitId);launch.searchParams.set('worktree',worktreeId);
 await writeFile('.data/sheet-features-runtime.json',JSON.stringify({launchUrl:launch.href,origin:app.origin,agentToken:app.agentToken,target,workspace}),{mode:0o600});
 await writeFile('.data/sheet-features-evidence.json',JSON.stringify({workspace,target,edit,read,baseline,exported,screenshot:{images:screenshot.images.map(({data,...rest})=>rest)}},null,2));
 console.log(JSON.stringify({pid:process.pid,workspace,target,formulaTotal:5280,conditionalRules:1,phase:'UI ready'}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
