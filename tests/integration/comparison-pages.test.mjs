import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compare,ComparisonPages} from '../../dist/application/comparison.js';
import {completeComparison} from '../../dist/shared/comparison-pages.js';
import {visibleComparisonItems} from '../../dist/shared/comparison-presentation.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../../dist/server/main.js';

const target={fileId:'file',unitId:'book',branch:'worktree',worktreeId:'draft'};
function largeSheet(){
 const left={id:'book',name:'Paging',appVersion:'1',locale:'enUS',sheetOrder:['data'],styles:{},sheets:{data:{id:'data',name:'Data',rowCount:2300,columnCount:2,cellData:{}}}};
 for(let i=0;i<2205;i++)left.sheets.data.cellData[i]={0:{v:`before-${i}`}};
 const right=structuredClone(left);
 for(let i=0;i<2205;i++)right.sheets.data.cellData[i][0].v=`after-${i}`;
 return compare('sheet',target,null,{unitData:left,revision:1},{unitData:right,revision:2});
}

test('SDK paging exposes every Sheet change and late search/navigation without replacing the pinned record',async()=>{
 const record=largeSheet(),original=structuredClone(record),pages=new ComparisonPages(),requests=[];
 assert.equal(record.result.items.length,1000);assert.equal(record.result.page.hasMore,true);
 const result=await completeComparison(record.result,async(offset,contextOffset)=>{requests.push(offset);return pages.query(record,offset,contextOffset);});
 assert.deepEqual(requests,[1000,2000]);assert.equal(result.items.length,2205);assert.equal(new Set(result.items.map(i=>i.id)).size,2205);
 assert.equal(result.page.hasMore,false);assert.deepEqual(record,original);
 const last=visibleComparisonItems(result.items,{search:'after-2204'});assert.equal(last.length,1);
 assert.ok(last[0].locations.left.target);assert.ok(last[0].locations.right.target);
 const revived=JSON.parse(JSON.stringify(record));
 assert.deepEqual(new ComparisonPages().query(revived,2000,0),pages.query(record,2000,0));
});

test('Doc alignment continues paging even when there are no changed paragraphs',async()=>{
 let dataStream='';const paragraphs=[];
 for(let i=0;i<1105;i++){dataStream+=`Paragraph ${i}\r`;paragraphs.push({paragraphId:`p${i}`,startIndex:dataStream.length-1});}
 dataStream+='\n';
 const doc={id:'book',body:{dataStream,paragraphs}};
 const record=compare('doc',target,null,{unitData:doc,revision:1},{unitData:structuredClone(doc),revision:1}),pages=new ComparisonPages();
 assert.equal(record.result.items.length,0);assert.equal(record.result.productContext.paragraphAlignment.length,1000);
 const result=await completeComparison(record.result,async(offset,contextOffset)=>pages.query(record,offset,contextOffset));
 assert.equal(result.items.length,0);assert.equal(result.productContext.paragraphAlignment.length,1105);
 assert.equal(result.productContext.paragraphAlignmentPage.hasMore,false);
});

test('incomplete or mismatched pages fail instead of presenting a truncated comparison',async()=>{
 const record=largeSheet(),pages=new ComparisonPages();
 await assert.rejects(completeComparison(record.result,async(offset,contextOffset)=>({...pages.query(record,offset,contextOffset),items:[]})),/未返回后续/);
 await assert.rejects(completeComparison(record.result,async(offset,contextOffset)=>({...pages.query(record,offset,contextOffset),comparisonId:'different'})),/固定版本不一致/);
});

test('HTTP comparison pages require authorization, stay pinned and survive restart',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'office-comparison-pages-'));let app=await startServer({workspace,port:0});
 try{
  const file=await app.office.open('pages.univer',true),record=largeSheet();record.rightTarget.fileId=file.catalog.fileId;
  file.catalog.put('comparison',record.comparisonId,record);
  const path=`/api/files/${file.catalog.fileId}/comparisons/${record.comparisonId}/pages`;
  const request=async(query,auth=true)=>{const res=await fetch(app.origin+path+query,{headers:auth?{Authorization:`Bearer ${app.agentToken}`}:{}});return{status:res.status,data:await res.json()};};
  assert.equal((await request('?offset=1000',false)).status,401);
  assert.equal((await request('?offset=-1')).status,400);assert.equal((await request('?offset=0.5')).status,400);
  const second=await request('?offset=1000');assert.equal(second.status,200);assert.equal(second.data.items.length,1000);
  assert.equal((await request('?offset=2000')).data.items.length,205);
  assert.deepEqual(file.catalog.get('comparison',record.comparisonId),record);
  await app.close();app=await startServer({workspace,port:0});
  assert.deepEqual((await request('?offset=1000')).data,second.data);
 }finally{await app.close();await rm(workspace,{recursive:true,force:true});}
});
