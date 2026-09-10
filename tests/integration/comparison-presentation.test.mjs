import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compare} from '../../dist/application/comparison.js';
import {scopeKey, sheetComparisonSnapshot, visibleComparisonItems} from '../../dist/shared/comparison-presentation.js';
import {UniverSheetsTablePlugin} from '@univerjs/sheets-table';

const workbook=()=>({id:'book',name:'Report',appVersion:'1',locale:'enUS',sheetOrder:['first','second'],styles:{red:{bg:{rgb:'#ff0000'}}},
  defaultStyle:'red',sheets:Object.fromEntries(['first','second'].map(id=>[id,{id,name:id,rowCount:20,columnCount:8,
    defaultStyle:'red',rowData:{0:{h:32,s:'red'}},columnData:{0:{w:160,s:'red'}},cellData:{0:{0:{v:10,s:'red'},1:{v:20,s:'red'}},1:{0:{v:30}}}}]))});

test('SDK mixed cell changes split by content/style without losing scope, identity, navigation or structural changes',()=>{
  const left=workbook(),right=workbook();
  right.name='New report';right.sheets.first.cellData[0][0]={v:11,s:{bl:1}};
  right.sheets.first.cellData[0][1].s={it:1};right.sheets.second.cellData[1][0].v=31;
  const result=compare('sheet',{fileId:'file',unitId:'book',branch:'worktree',worktreeId:'draft'},null,{unitData:left,revision:1},{unitData:right,revision:2}).result;
  const original=structuredClone(result);
  const content=visibleComparisonItems(result.items,{sheetMode:'content'});
  const formatting=visibleComparisonItems(result.items,{sheetMode:'formatting'});
  assert.ok(content.some(item=>item.entityType==='cell'));
  assert.ok(formatting.some(item=>item.entityType==='cell'));
  for(const item of content.filter(item=>item.entityType==='cell'))assert.ok(item.changes.every(change=>change.path[0]!=='style'));
  for(const item of formatting.filter(item=>item.entityType==='cell'))assert.ok(item.changes.every(change=>change.path[0]==='style'));
  const mixed=result.items.find(item=>item.entityType==='cell'&&item.changes.some(c=>c.path[0]==='style')&&item.changes.some(c=>c.path[0]!=='style'));
  assert.ok(mixed);assert.deepEqual(content.find(i=>i.id===mixed.id).locations,mixed.locations);assert.ok(formatting.some(i=>i.id===mixed.id));
  const group=result.scopes.find(scope=>scope.stableId==='second');assert.ok(group);
  const scoped=visibleComparisonItems(result.items,{scope:scopeKey(group)});assert.ok(scoped.length);assert.ok(scoped.every(item=>item.scope.stableId==='second'));
  const searched=visibleComparisonItems(result.items,{search:'31'});assert.ok(searched.length);assert.ok(searched.length<result.items.length);
  assert.deepEqual(result,original);
});

test('plain display retains geometry, formulas, table identity and unrelated resources while removing visual styles',()=>{
  const source=workbook();source.sheets.first.cellData[2]={0:{f:'=A1+$B$1',si:'shared',v:30,s:'red'},1:{si:'shared',v:40}};
  source.sheets.first.cellData[3]={0:{p:{id:'rich',body:{dataStream:'Rich text\r\n',textRuns:[{st:0,ed:4,ts:{bl:1}}]}}}};
  source.resources=[{name:UniverSheetsTablePlugin.pluginName,data:JSON.stringify({first:{tables:[{id:'table1',name:'Sales',options:{tableStyleId:'table-default-1',showHeader:true}}]}})},
    {name:'SHEET_RANGE_THEME_MODEL_PLUGIN',data:'{"rangeThemeStyleMapJson":{"red":{"name":"red"}}}'},
    {name:'SHEET_CONDITIONAL_FORMATTING_PLUGIN',data:'{}'},
    {name:'SHEET_FILTER_PLUGIN',data:'{"first":{"ref":"A1:B5"}}'}];
  const original=structuredClone(source),plain=sheetComparisonSnapshot(source,'content');
  assert.deepEqual(source,original);assert.deepEqual(sheetComparisonSnapshot(source,'formatting'),original);
  assert.deepEqual(plain.styles,{});assert.equal(plain.defaultStyle,undefined);assert.equal(plain.sheets.first.cellData[0][0].s,undefined);
  assert.equal(plain.sheets.first.rowData[0].h,32);assert.equal(plain.sheets.first.columnData[0].w,160);
  assert.equal(plain.sheets.first.cellData[2][0].f,'=A1+$B$1');assert.equal(plain.sheets.first.cellData[2][1].si,'shared');assert.equal(plain.sheets.first.cellData[2][1].v,40);
  assert.equal(plain.sheets.first.cellData[3][0].p,undefined);assert.match(plain.sheets.first.cellData[3][0].v,/Rich text/);
  assert.equal(plain.resources.some(r=>r.name==='SHEET_CONDITIONAL_FORMATTING_PLUGIN'),false);
  assert.deepEqual(plain.resources.find(r=>r.name==='SHEET_FILTER_PLUGIN'),source.resources[3]);
  const table=JSON.parse(plain.resources.find(r=>r.name===UniverSheetsTablePlugin.pluginName).data).first.tables[0];
  assert.equal(table.id,'table1');assert.equal(table.options.showHeader,true);
  const themes=JSON.parse(plain.resources.find(r=>r.name==='SHEET_RANGE_THEME_MODEL_PLUGIN').data);
  assert.deepEqual(themes.rangeThemeStyleMapJson[table.options.tableStyleId],{name:table.options.tableStyleId});
});
