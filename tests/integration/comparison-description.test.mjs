import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparisonChangeLines,comparisonItemCaption} from '../../dist/shared/comparison-description.js';
import {visibleComparisonItems} from '../../dist/shared/comparison-presentation.js';

const item=(entityType,changes,kind='update')=>({id:'change',stableId:'stable',entityType,kind,changes,locations:{left:{target:{stableId:'left'}},right:{target:{stableId:'right'}}}});
const change=(path,before,after)=>({path,before,after});

test('Slide SDK text projections show one readable change without exposing generated paragraph IDs',()=>{
 const input=item('slide-element',[
  change(['shapeData','shapeText','dataModel','doc','body','paragraphs',0,'paragraphId'],'para_old','para_new'),
  change(['shapeData','shapeText','text'],'项目进展 · 修改前','项目进展 · 修改后'),
  change(['text'],'项目进展 · 修改前\r\n','项目进展 · 修改后\r\n'),
 ]),original=structuredClone(input);
 assert.deepEqual(comparisonChangeLines(input),['文本：项目进展 · 修改前 → 项目进展 · 修改后']);
 assert.deepEqual(input,original);
 assert.deepEqual(visibleComparisonItems([input],{search:'文本'}),[input]);
 assert.deepEqual(visibleComparisonItems([input],{search:'修改后'})[0].locations,input.locations);
});

test('five-product content, formatting and geometry descriptions preserve meaningful values',()=>{
 const cases=[
  [item('cell',[change(['value'],0,false),change(['formula'],'=A1','=A2')]),['内容：0 → 否','公式：=A1 → =A2']],
  [item('paragraph',[change(['text'],'原文','新文'),change(['paragraphStyle','customSpacing'],{v:1},{v:2})]),['文本：原文 → 新文','段落格式已更新']],
  [item('slide-element',[change(['transform','left'],100,140),change(['shapeData','fill','color'],'#fff','#000')]),['水平位置：100 → 140','颜色：#fff → #000']],
  [item('cell',[change([],null,'已发货')]),['内容：空 → 已发货']],
  [item('board-element',[change(['text'],'待办','完成'),change(['transform','width'],200,240)]),['文本：待办 → 完成','宽度：200 → 240']],
 ];
 for(const [input,expected] of cases)assert.deepEqual(comparisonChangeLines(input),expected);
});

test('structural changes, metadata-only changes and long distinct values remain visible',()=>{
 assert.deepEqual(comparisonChangeLines(item('paragraph',[change(['paragraphId'],'old','new')])),['段落标识已更新']);
 assert.deepEqual(comparisonChangeLines(item('view',[change(['filter'],null,{rules:[]})])),['筛选已新增']);
 assert.deepEqual(comparisonChangeLines(item('slide',[],'delete')),['已移除内容']);
 assert.deepEqual(comparisonChangeLines(item('record',[],'insert')),['已新增内容']);
 const prefix='a'.repeat(200),input=item('paragraph',[change(['text'],prefix+'1',prefix+'2'),change(['text'],prefix+'3',prefix+'4')]);
 const lines=comparisonChangeLines(input);assert.equal(lines.length,2);assert.ok(lines[0].endsWith('2'));assert.ok(lines[1].endsWith('4'));
 assert.deepEqual(comparisonChangeLines(item('cell',[change(['value'],'',' ')])),['内容：空文本 →  ']);
});

test('document and board captions replace SDK entity names and generated IDs while preserving user names',()=>{
 assert.equal(comparisonItemCaption({...item('text-style',[],'insert'),stableId:'para_generated',displayName:'para_generated'},7),'新增 文字格式 · 变更 7');
 assert.equal(comparisonItemCaption({...item('document-style',[]),stableId:'root',displayName:'root'},8),'修改 页面格式');
 assert.equal(comparisonItemCaption({...item('board-page',[]),displayName:'项目计划'},9),'修改 白板页面 · 项目计划');
 assert.equal(comparisonItemCaption({...item('cell',[]),stableId:'A1',displayName:'A1'},10),'修改 单元格 · A1');
 assert.equal(comparisonItemCaption({...item('cell',[]),stableId:'B2'},11),'修改 单元格 · B2');
 assert.deepEqual(comparisonChangeLines(item('section',[change(['sectionId'],null,'section_generated')],'insert')),['分节标识已新增']);
 assert.deepEqual(comparisonChangeLines(item('paragraph',[change(['text'],null,'新增正文')],'insert')),['文本：新增正文']);
 assert.deepEqual(comparisonChangeLines(item('text-style',[change([],null,{runs:[]})],'insert')),['文字格式已新增']);
 assert.deepEqual(comparisonChangeLines(item('table',[change(['geometry','width','v'],100,200)])),['宽度：100 → 200']);
});

test('Board summaries prioritize content and describe connections without rendering internal endpoint IDs',()=>{
 const input=item('board-element',[change(['id'],null,'generated'),change(['name'],null,'连接线'),change(['connectorData','start','shapeId'],null,'internal_shape'),change(['connectorData','start','connectionSiteId'],null,3),change(['connectorData','end','shapeId'],null,'internal_end')],'insert');
 assert.deepEqual(comparisonChangeLines(input),['起点连接已新增','终点连接已新增','名称：连接线']);
 assert.deepEqual(comparisonChangeLines(item('board-element',[change(['name'],null,'形状'),change(['shapeData','shapeText','text'],null,'项目完成'),change(['geometry','width'],null,300)],'insert')),['文本：项目完成','名称：形状','宽度：300']);
});

test('Sheet value type and BooleanNumber flags use SDK meanings without changing ordinary numeric values',()=>{
 assert.deepEqual(comparisonChangeLines(item('cell',[change(['valueType'],1,2),change(['value'],1,2)])),['内容：1 → 2','数据类型：文本 → 数字']);
 assert.deepEqual(comparisonChangeLines(item('worksheet',[change(['hidden'],0,1)])),['隐藏状态：否 → 是']);
});
