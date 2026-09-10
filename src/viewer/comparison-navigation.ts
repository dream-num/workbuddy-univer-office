import type {IUnitComparisonNavigationTarget} from '@univerjs-pro/edit-history';
import type {FUniver} from '@univerjs/core/facade';
import type {UnitKind} from '../shared/contracts.js';
import '@univerjs/docs-ui/facade';
import '@univerjs/sheets-ui/facade';
import '@univerjs-pro/bases-ui/facade';
import '@univerjs-pro/boards-ui/facade';

export async function navigateComparison(api:FUniver,kind:UnitKind,target?:IUnitComparisonNavigationTarget){
  if(!target)return '此版本中不存在';
  if(kind==='sheet'){
    const book=api.getActiveWorkbook();
    const sheetId=target.entityType==='worksheet'?target.stableId:target.parentStableId;
    const sheet=sheetId?book?.getSheetBySheetId(sheetId):book?.getActiveSheet();
    if(!book||!sheet)throw new Error('找不到目标工作表');
    book.setActiveSheet(sheet);
    if(target.entityType==='cell'&&target.kind==='entity'){const range=sheet.getRange(target.stableId),r=range.getRange();book.setActiveRange(range);sheet.scrollToCell(r.startRow,r.startColumn);return '已定位单元格';}
    if(target.kind==='sheet-range'&&target.range){const r=target.range;book.setActiveRange(sheet.getRange(r.startRow,r.startColumn,r.endRow-r.startRow+1,r.endColumn-r.startColumn+1));sheet.scrollToCell(r.startRow,r.startColumn);return '已定位单元格范围';}
    return '已定位工作表';
  }
  if(kind==='doc'&&(target.entityType==='paragraph'||target.entityType==='text-style')){
    const doc=api.getActiveDocument(),paragraph=doc?.getParagraph(target.stableId);
    if(!doc||!paragraph)throw new Error('找不到目标段落');
    const range=paragraph.getRange();
    if(range.segmentId)throw new Error('页眉页脚的定位尚未支持');
    doc.setSelection(range.startOffset,range.endOffset);
    return '已定位段落';
  }
  if(kind==='slide'&&(target.entityType==='slide'||target.entityType==='slide-element')){
    const presentation=api.getActivePresentation();
    const slide=presentation?.getSlideById(target.entityType==='slide'?target.stableId:target.parentStableId??'');
    if(!presentation||!slide)throw new Error('找不到目标幻灯片');
    presentation.setActiveSlide(slide);
    return target.entityType==='slide'?'已定位幻灯片':'已定位所在幻灯片；变化元素已描边标记';
  }
  if(kind==='base'){
    const base=api.getActiveBase(),ui=api.getBaseUI();
    const tableId=target.kind==='base-cell'?target.tableId:target.entityType==='table'?target.stableId:target.parentStableId;
    const table=tableId?base?.getTableById(tableId):null;
    if(!table)throw new Error('此变化没有可定位的数据表');
    await ui.activateTable(table.getId());
    if(target.entityType==='view'){await ui.activateView(target.stableId);return '已定位视图';}
    if(target.entityType==='table')return '已定位数据表';
    const viewId=ui.getActiveViewId();
    const view=viewId?table.getViewById(viewId):null;
    if(!view||view.getView().type!=='grid')throw new Error('当前视图不是可定位的网格视图');
    const projection=view.getProjection();
    if(projection.type!=='grid')throw new Error('视图数据尚未就绪');
    const recordId=target.kind==='base-cell'?target.recordId:target.entityType==='record'?target.stableId:undefined;
    const fieldId=target.kind==='base-cell'?target.fieldId:target.entityType==='field'?target.stableId:undefined;
    if(recordId&&!projection.rows.some(row=>row.recordId===recordId))throw new Error('该记录在当前视图中不可见');
    if(fieldId&&!projection.fields.some(field=>field.id===fieldId))throw new Error('该字段在当前视图中不可见');
    if(recordId&&fieldId){ui.scrollToRecord(recordId);ui.scrollToField(fieldId);ui.setSelection({type:'grid-cell',tableId:table.getId(),viewId:view.getId(),recordId,fieldId});return '已定位记录单元格';}
    if(recordId){ui.scrollToRecord(recordId);ui.setSelection({type:'grid-record',tableId:table.getId(),viewId:view.getId(),recordId});return '已定位记录';}
    if(fieldId){ui.scrollToField(fieldId);ui.setSelection({type:'grid-field',tableId:table.getId(),viewId:view.getId(),fieldId});return '已定位字段';}
  }
  if(kind==='board'&&target.entityType==='board-element'){
    const board=api.getActiveBoard();
    if(!board?.focusElement(target.stableId,{x:innerWidth*0.55,y:innerHeight*0.5}))throw new Error('无法聚焦目标白板元素');
    return '已定位白板元素';
  }
  return '此类变化尚不支持定位';
}
