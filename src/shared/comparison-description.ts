import type {IUnitComparisonItem} from '@univerjs-pro/edit-history';
import {CellValueType} from '@univerjs/core';

const labels:Record<string,string>={
 text:'文本',dataStream:'文本',value:'内容',v:'内容',formula:'公式',f:'公式',name:'名称',title:'标题',
 left:'水平位置',top:'垂直位置',width:'宽度',height:'高度',rotation:'旋转角度',visible:'可见性',
 color:'颜色',rgb:'颜色',opacity:'不透明度',fontSize:'字号',fs:'字号',fontFamily:'字体',ff:'字体',
 bold:'加粗',bl:'加粗',italic:'斜体',it:'斜体',underline:'下划线',ul:'下划线',
 horizontalAlign:'水平对齐',verticalAlign:'垂直对齐',wrapStrategy:'文本换行',
 rowCount:'行数',columnCount:'列数',h:'行高',w:'列宽',hidden:'隐藏状态',
 background:'背景',fill:'填充',stroke:'边框',border:'边框',bg:'背景色',cl:'文字颜色',
 type:'类型',shapeType:'形状',speakerNotes:'演讲备注',filter:'筛选',sort:'排序',
 paragraphId:'段落标识',sectionId:'分节标识',order:'顺序',orderKey:'顺序',
 tableId:'关联表格',defaultHeaderId:'默认页眉',defaultFooterId:'默认页脚',
 firstPageHeaderId:'首页页眉',firstPageFooterId:'首页页脚',evenPageHeaderId:'偶数页页眉',evenPageFooterId:'偶数页页脚',
 marginTop:'上边距',marginBottom:'下边距',marginLeft:'左边距',marginRight:'右边距',marginHeader:'页眉距离',marginFooter:'页脚距离',
 pageSize:'页面尺寸',renderConfig:'显示设置',documentFlavor:'文档类型',useFirstPageHeaderFooter:'首页页眉页脚',evenAndOddHeaders:'奇偶页页眉',
 autoHyphenation:'自动断字',consecutiveHyphenLimit:'连续断字限制',doNotHyphenateCaps:'大写单词断字',
 align:'对齐',distB:'下侧间距',distL:'左侧间距',distR:'右侧间距',distT:'上侧间距',indent:'缩进',
 tableColumns:'表格列',tableRows:'表格行',textWrap:'文字环绕',paragraphs:'段落结构',sectionBreaks:'分节设置',textRuns:'文字格式',
 valueType:'数据类型',columnHeader:'列标题',rowHeader:'行标题',defaultColumnWidth:'默认列宽',defaultRowHeight:'默认行高',freeze:'冻结窗格',mergeData:'合并单元格',rightToLeft:'从右向左显示',scrollLeft:'水平滚动位置',scrollTop:'垂直滚动位置',showGridlines:'显示网格线',tabColor:'标签颜色',zoomRatio:'缩放比例',
};
const metadata=new Set(['id','paragraphId','sectionId']);
const identifier=new Set(['id','paragraphId','sectionId','tableId','defaultHeaderId','defaultFooterId','firstPageHeaderId','firstPageFooterId','evenPageHeaderId','evenPageFooterId']);
const entities:Record<string,string>={cell:'单元格',worksheet:'工作表',paragraph:'段落',slide:'幻灯片','slide-element':'页面元素',record:'记录',field:'字段',view:'视图','board-element':'白板元素','board-page':'白板页面',chart:'图表',table:'表格','text-style':'文字格式',section:'分节','table-range':'表格范围','custom-decoration':'文字装饰','document-style':'页面格式','document-setting':'文档设置','condition-format':'条件格式',pivot:'数据透视表','data-validation':'数据验证'};
const actions={insert:'新增',delete:'删除',update:'修改'};
export function comparisonItemCaption(item:Pick<IUnitComparisonItem,'kind'|'entityType'|'displayName'|'stableId'>,number:number){
 const type=entities[item.entityType]??'内容';
 const display=item.displayName??(item.entityType==='cell'?item.stableId:undefined);
 const name=display&&display!=='root'&&(display!==item.stableId||item.entityType==='cell')?display:undefined;
 return `${actions[item.kind]} ${type}${name?' · '+name:item.stableId==='root'?'':' · 变更 '+number}`;
}
function label(path:readonly (string|number)[],entityType:string){
 const keys=path.map(String),last=keys.at(-1)??'';
 if(!keys.length)return entityType==='cell'?'内容':entities[entityType]??'内容';
 if(last==='v'&&labels[keys.at(-2)??''])return labels[keys.at(-2)!];
 if(labels[last])return labels[last];
 if(keys.includes('textRuns')||keys.includes('textStyle'))return '文字格式';
 if(keys.includes('paragraphStyle'))return '段落格式';
 if(keys.includes('style')||keys.includes('shapeData'))return '样式';
 if(keys.includes('transform'))return '位置与尺寸';
 if(keys.includes('values')||keys.includes('cellData')||!keys.length)return '内容';
 return '其他属性';
}
const valueTypes:Record<number,string>={[CellValueType.STRING]:'文本',[CellValueType.NUMBER]:'数字',[CellValueType.BOOLEAN]:'布尔值',[CellValueType.FORCE_STRING]:'强制文本'};
const booleanFields=new Set(['hidden','visible','bl','bold','it','italic','showGridlines','rightToLeft','isHorizontal']);
function value(input:unknown,field?:string):string|undefined{
 if(input===undefined||input===null)return '空';
 if(field==='valueType'&&typeof input==='number'&&valueTypes[input])return valueTypes[input];
 if(booleanFields.has(field??'')&&(input===0||input===1))return input?'是':'否';
 if(typeof input==='boolean')return input?'是':'否';
 if(typeof input==='number')return String(input);
 if(typeof input==='string'){
  // SDK text projections may append document terminators; keep ordinary spaces meaningful.
  const text=input.replace(/(?:\r\n|\r|\n)$/,'').replace(/\r\n|\r|\n/g,' ↵ ');
  return text||'空文本';
 }
 if(typeof input==='object'&&!Array.isArray(input)&&'rgb' in input&&typeof input.rgb==='string')return input.rgb;
 return undefined;
}
function priority(line:string){
 if(/^(文本|内容|公式)[：已]/.test(line))return 0;
 if(/^(起点连接|终点连接)/.test(line))return 1;
 if(/^名称：/.test(line))return 2;
 if(/^(水平位置|垂直位置|宽度|高度|旋转角度)：/.test(line))return 3;
 return line.startsWith('其他属性')?9:4;
}

/** Display SDK changes in user language without modifying the comparison or its navigation targets. */
export function comparisonChangeLines(item:Pick<IUnitComparisonItem,'kind'|'changes'|'entityType'>):string[]{
 const changes=item.changes;
 const meaningful=changes.filter(change=>!metadata.has(String(change.path.at(-1))));
 const visible=meaningful.length?meaningful:changes;
 const lines=visible.map(change=>{
  const name=label(change.path,item.entityType),field=String(change.path.at(-1)),before=value(change.before,field),after=value(change.after,field);
  const verb=change.before==null?'已新增':change.after==null?'已移除':'已更新';
  if(change.path[0]==='connectorData'&&['start','end'].includes(String(change.path[1])))return `${change.path[1]==='start'?'起点连接':'终点连接'}${verb}`;
  if(identifier.has(String(change.path.at(-1))))return `${name}${verb}`;
  if(before===undefined||after===undefined){
   return `${name}${verb}`;
  }
  if(item.kind==='insert'&&change.before==null)return `${name}：${after}`;
  if(item.kind==='delete'&&change.after==null)return `${name}：${before}`;
  return `${name}：${before} → ${after}`;
 });
 const unique=[...new Set(lines)].sort((a,b)=>priority(a)-priority(b));
 return unique.length?unique:[item.kind==='insert'?'已新增内容':item.kind==='delete'?'已移除内容':'属性已更新'];
}
