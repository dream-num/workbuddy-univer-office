import {ICommandService,Inject,Injector,Plugin,UniverInstanceType} from '@univerjs/core';
import type {IDisposable} from '@univerjs/core';
import {IRenderManagerService} from '@univerjs/engine-render';
import {HistoryCanvasHighlightService,HistoryHighlightService} from '@univerjs-pro/edit-history-ui';
import type {HistoryChangeKind,IUnitComparisonNavigationTarget} from '@univerjs-pro/edit-history';
import type {FUniver} from '@univerjs/core/facade';
import {buildDrawingOKey,SLIDE_PAGE_RECT_KEY} from '@univerjs-pro/slides-ui';
import {getBoardElementRenderObjectKey} from '@univerjs-pro/boards-ui';
import {BASE_CANVAS_COMPONENT_KEY,BaseCanvasRenderComponent} from '@univerjs-pro/bases-ui';
import {calcDocRangePositions} from '@univerjs/docs-ui';
import '@univerjs/sheets-ui/facade';
import type {UnitKind} from '../shared/contracts.js';
import {compactComparisonRanges,type ComparisonRange} from '../shared/comparison-ranges.js';

export interface ComparisonMark {id:string;kind:HistoryChangeKind;target?:IUnitComparisonNavigationTarget}
interface HighlightConfig {ready:(service:ComparisonHighlighter)=>void;refresh:()=>void}
/** Snapshot-only services: no document mutations or changes to the SDK. */
export class ComparisonHighlightPlugin extends Plugin {
  static override pluginName='WORKBUDDY_COMPARISON_HIGHLIGHT';
  static override type=UniverInstanceType.UNIVER_UNKNOWN;
  constructor(private readonly config:HighlightConfig,protected override readonly _injector:Injector){super();}
  override onStarting(){
    this._injector.add([HistoryHighlightService]);
    this._injector.add([HistoryCanvasHighlightService]);
  }
  override onRendered(){
    const service=new ComparisonHighlighter(this._injector.get(HistoryCanvasHighlightService),this._injector.get(HistoryHighlightService),this._injector.get(IRenderManagerService));
    this.disposeWithMe(service);this.config.ready(service);
    this.disposeWithMe(this._injector.get(ICommandService).onCommandExecuted(()=>this.config.refresh()));
  }
}
Inject(Injector)(ComparisonHighlightPlugin,undefined,1);

const fills:Record<HistoryChangeKind,string>={insert:'rgba(22,163,74,0.12)',delete:'rgba(220,38,38,0.12)',update:'rgba(217,153,0,0.15)'};
type Box={left:number;top:number;width:number;height:number;kind:HistoryChangeKind};
export class ComparisonHighlighter {
  private ranges:IDisposable[]=[];
  private key='';
  private domKey='';
  private layer:HTMLDivElement|undefined;
  constructor(private canvas:HistoryCanvasHighlightService,private colors:HistoryHighlightService,private renders:IRenderManagerService){}
  dispose(){this.ranges.forEach(r=>r.dispose());this.ranges=[];this.layer?.remove();}
  async show(api:FUniver,kind:UnitKind,marks:ComparisonMark[],force=false){
    if(kind==='slide'){
      const presentation=api.getActivePresentation(),slide=presentation?.getActiveSlide();
      if(!presentation||!slide)return;
      const key=slide.getId();if(!force&&key===this.key)return;this.key=key;
      const targets=marks.flatMap(mark=>{
        const t=mark.target;if(!t)return [];
        if(t.entityType==='slide'&&t.stableId===slide.getId())return [{id:mark.id,kind:mark.kind,objectKey:SLIDE_PAGE_RECT_KEY,outlineOnly:true}];
        if(t.entityType==='slide-element'&&t.parentStableId===slide.getId())return [{id:mark.id,kind:mark.kind,objectKey:buildDrawingOKey(presentation.getId(),slide.getId(),t.stableId),outlineOnly:true}];
        return [];
      });
      await this.canvas.show(presentation.getId(),targets);return;
    }
    if(kind==='board'){
      const board=api.getActiveBoard();if(!board||(!force&&this.key===board.getId()))return;this.key=board.getId();
      await this.canvas.show(board.getId(),marks.flatMap(m=>m.target?.entityType==='board-element'?[{id:m.id,kind:m.kind,objectKey:getBoardElementRenderObjectKey(board.getId(),m.target.stableId),outlineOnly:true}]:[]));return;
    }
    if(kind==='sheet'){
      const book=api.getActiveWorkbook(),sheet=book?.getActiveSheet();if(!book||!sheet)return;
      if(!force&&this.key===sheet.getSheetId())return;this.key=sheet.getSheetId();
      this.ranges.forEach(r=>r.dispose());this.ranges=[];
      const ranges:ComparisonRange[]=[];
      for(const m of marks){
        const t=m.target;if(!t||t.parentStableId&&t.parentStableId!==sheet.getSheetId())continue;
        if(t.kind==='entity'&&t.entityType==='cell')ranges.push({...sheet.getRange(t.stableId).getRange(),kind:m.kind});
        if(t.kind==='sheet-axis')ranges.push(t.axis==='row'?{startRow:t.start,endRow:t.end,startColumn:0,endColumn:sheet.getMaxColumns()-1,kind:m.kind}:{startRow:0,endRow:sheet.getMaxRows()-1,startColumn:t.start,endColumn:t.end,kind:m.kind});
        if(t.kind==='sheet-range')for(const r of t.ranges??(t.range?[t.range]:[])){
          ranges.push({...r,kind:m.kind});
        }
      }
      for(const r of compactComparisonRanges(ranges))this.ranges.push(sheet.getRange(r.startRow,r.startColumn,r.endRow-r.startRow+1,r.endColumn-r.startColumn+1).highlight({...this.colors.getStyle(r.kind),fill:fills[r.kind],strokeWidth:2}));
      return;
    }
    const boxes:Box[]=[];
    if(kind==='doc'){
      const doc=api.getActiveDocument(),render=doc&&this.renders.getRenderUnitById(doc.getId());if(!doc||!render)return;
      const clip=render.engine.getCanvasElement()?.getBoundingClientRect();
      for(const m of marks){
        const t=m.target;if(!t||!['paragraph','text-style'].includes(t.entityType))continue;
        const paragraph=doc.getParagraph(t.stableId);if(!paragraph)continue;
        const range=paragraph.getRange();
        for(const r of calcDocRangePositions({...range,collapsed:false},render)??[]){
          const left=Math.max(r.left,clip?.left??0),top=Math.max(r.top,clip?.top??0),right=Math.min(r.right,clip?.right??innerWidth),bottom=Math.min(r.bottom,clip?.bottom??innerHeight);
          if(right>left&&bottom>top)boxes.push({left,top,width:right-left,height:bottom-top,kind:m.kind});
        }
      }
    }
    if(kind==='base'){
      const base=api.getActiveBase();if(!base)return;
      const render=this.renders.getRenderUnitById(base.getId());
      if(!render)return;
      const component=render.scene.getObject(BASE_CANVAS_COMPONENT_KEY)??render.components.get(BASE_CANVAS_COMPONENT_KEY)??render.mainComponent;
      if(!(component instanceof BaseCanvasRenderComponent))return;
      const canvas=render.engine.getCanvasElement();if(!canvas)return;
      const rect=canvas.getBoundingClientRect();
      const sx=rect.width/(parseFloat(canvas.style.width)||rect.width),sy=rect.height/(parseFloat(canvas.style.height)||rect.height);
      const regions=component.getController().getHitRegions();
      for(const m of marks){
        const t=m.target;if(!t)continue;
        const tableId=t.kind==='base-cell'?t.tableId:t.entityType==='table'?t.stableId:t.parentStableId;
        const recordId=t.kind==='base-cell'?t.recordId:t.entityType==='record'?t.stableId:undefined;
        const fieldId=t.kind==='base-cell'?t.fieldId:t.entityType==='field'?t.stableId:undefined;
        const seen=new Set<string>();
        for(const region of regions){
          const hit=region.result;
          if(!['grid-cell','grid-row-header','grid-field','kanban-card','calendar-event','gantt-cell','gantt-bar','gallery-card'].includes(hit.type))continue;
          if(!('tableId' in hit)||hit.tableId!==tableId)continue;
          if(recordId&&(!('recordId' in hit)||hit.recordId!==recordId))continue;
          if(fieldId&&(!('fieldId' in hit)||hit.fieldId!==fieldId))continue;
          if(t.entityType==='view'&&(!('viewId' in hit)||hit.viewId!==t.stableId))continue;
          if(!recordId&&!fieldId&&!['view','table'].includes(t.entityType))continue;
          const r=region.rect,key=JSON.stringify(r);if(seen.has(key))continue;seen.add(key);
          const left=Math.max(rect.left,rect.left+r.x*sx),top=Math.max(rect.top,rect.top+r.y*sy),right=Math.min(rect.right,rect.left+(r.x+r.width)*sx),bottom=Math.min(rect.bottom,rect.top+(r.y+r.height)*sy);
          if(right>left&&bottom>top)boxes.push({left,top,width:right-left,height:bottom-top,kind:m.kind});
        }
      }
    }
    this.drawBoxes(boxes);
  }
  private drawBoxes(boxes:Box[]){
    boxes=[...new Map(boxes.map(box=>[JSON.stringify(box),box])).values()];
    const key=JSON.stringify(boxes);if(key===this.domKey)return;this.domKey=key;
    if(!this.layer){this.layer=document.createElement('div');this.layer.className='office-comparison-highlights';this.layer.setAttribute('aria-hidden','true');this.layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden';document.body.append(this.layer);}
    this.layer.replaceChildren(...boxes.map(box=>{const el=document.createElement('div'),style=this.colors.getStyle(box.kind);el.dataset.kind=box.kind;el.style.cssText=`position:absolute;box-sizing:border-box;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border:2px solid ${style.stroke};background:${fills[box.kind]};pointer-events:none`;return el;}));
  }
}
