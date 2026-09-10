import {mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
const workspace=await mkdtemp(resolve('.data/sheet-data-'));
const app=await startServer({workspace,port:9082});
const call=async(path,body)=>{
 const response=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
};
try{
 const {fileId}=await call('/files',{file:'sheet-data.univer'});
 const {worktreeID:worktreeId}=await call(`/files/${fileId}/worktrees`,{});
 const {unitId}=await call(`/files/${fileId}/units`,{worktreeId,kind:'sheet',name:'筛选排序与表格验证'});
 const target={fileId,unitId,worktreeId,branch:'worktree'};
 const edit=await call('/content',{target,action:'execute',mode:'write',code:`
 const sheet=workbook.getActiveSheet();
 sheet.getRange('A1:D1').merge().setValue('销售明细 · 筛选与排序').setBackground('#245442').setFontColor('#ffffff').setFontSize(18);
 sheet.setRowHeight(0,44);
 sheet.getRange('A3:D7').setValues([['地区','产品','销售额','状态'],['华东','协作',1200,'已检查'],['华西','分析',500,'待审阅'],['华东','文档',1800,'已检查'],['华南','协作',900,'待审阅']]);
 sheet.getRange('A4:D7').sort({column:2,ascending:false});
 const filter=sheet.getRange('A3:D7').createFilter();
 if(!filter)throw new Error('Filter creation failed');
 filter.setColumnFilterCriteria(0,{colId:0,filters:{filters:['华东']}});
 sheet.getRange('F3:H6').setValues([['项目','负责人','预算'],['网站','林',800],['报表','周',1200],['文档','陈',600]]);
 if(!await sheet.addTable('项目预算',sheet.getRange('F3:H6').getRange(),'budget-table',{tableStyleId:'table-default-4'}))throw new Error('Table creation failed');
 sheet.getRange('A9:D9').merge().setValue('左侧只显示华东，销售额降序；右侧为表格对象。');
 for(let c=0;c<8;c++)sheet.setColumnWidth(c,c===4?40:150);
 sheet.getRange('A3:D3').setBackground('#e3f0e8').setFontWeight('bold');
 return true;
 `});
 assert.equal(edit.commit,'confirmed');
 const read=await call('/content',{target,action:'execute',mode:'read',code:`const s=workbook.getActiveSheet();return {rows:s.getRange('A3:D7').getRawValues(),hidden:s.getFilter().getFilteredOutRows(),criteria:s.getFilter().getColumnFilterCriteria(0),tables:s.getSubTableInfos()};`});
 assert.deepEqual(read.value.rows.slice(1).map(r=>r[2]),[1800,1200,900,500]);
 assert.deepEqual(read.value.hidden,[5,6]);
 assert.equal(read.value.tables.length,1);
 const exported=await call('/delivery',{target,action:'export',output:'sheet-data.xlsx'});
 const screenshot=await call('/delivery',{target,action:'screenshot',output:'sheet-data.png'});
 const launch=new URL(app.launchUrl);launch.searchParams.set('file',fileId);launch.searchParams.set('unit',unitId);launch.searchParams.set('worktree',worktreeId);
 await writeFile('.data/sheet-data-target.json',JSON.stringify({workspace,target},null,2));
 await writeFile('.data/sheet-data-runtime.json',JSON.stringify({launchUrl:launch.href,origin:app.origin,agentToken:app.agentToken,target,workspace}),{mode:0o600});
 await writeFile('.data/sheet-data-evidence.json',JSON.stringify({workspace,target,edit,read,exported,imageCount:screenshot.images.length},null,2));
 console.log(JSON.stringify({pid:process.pid,workspace,phase:'UI ready',hidden:read.value.hidden,tableCount:read.value.tables.length}));
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
