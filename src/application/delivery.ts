import {randomUUID} from 'node:crypto';
import {writeFile,link,unlink} from 'node:fs/promises';
import {extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {UniverInstanceType,type IBaseSnapshot,type IWorkbookData,type IDocumentData} from '@univerjs/core';
import type {ISlideData} from '@univerjs-pro/slides';
import {ExchangeFormat,BaseFormulaPolicy,importBuffer,exportToBuffer} from '@univerjs-pro/exchange-node';
import {createUniverRenderRuntime,type UniverRenderUnit,type UniverRenderRuntime} from '@univer-cli/univer-render-runtime';
import {createUnitScreenshot,type UnitScreenshotInput} from '@univer-cli/unit-screenshot';
import {createUnitPdfPrinter} from '@univer-cli/unit-pdf-printer';
import {createUnitLayoutLint} from '@univer-cli/unit-layout-lint';
import {OfficeError,type UnitKind} from '../shared/contracts.js';

/** Publish completed bytes exclusively, so concurrent exporters cannot overwrite a deliverable. */
export async function publish(output:string,bytes:Uint8Array){
  const temporary=`${output}.${randomUUID()}.tmp`;
  await writeFile(temporary,bytes,{flag:'wx',mode:0o600});
  try{await link(temporary,output);}
  catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new OfficeError('OUTPUT_EXISTS','The output file already exists. Choose a new filename.');throw error;}
  finally{await unlink(temporary);}
  return {output,bytes:bytes.byteLength};
}
export async function exportOffice(kind:UnitKind,data:unknown,output:string){
  const extension=extname(output).toLowerCase().slice(1);
  let bytes:Uint8Array;
  if(kind==='base'&&['xlsx','csv','tsv'].includes(extension)){
    const selected=data as IBaseSnapshot,table=selected.tables[selected.tableOrder[0]!]!;
    // Let Exchange resolve Base field representations before projecting user-facing columns.
    const native=await exportToBuffer(selected,{type:UniverInstanceType.UNIVER_BASE,format:ExchangeFormat.XLSX,formulaPolicy:BaseFormulaPolicy.VALUES});
    const converted=await importBuffer(native,{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX,fileName:'base-projection.xlsx'});
    if(converted.sheetOrder.length!==1)throw new OfficeError('BASE_EXPORT_REPRESENTATION','SDK produced auxiliary sheets; this field representation needs additional export support.');
    const original=converted.sheets[converted.sheetOrder[0]!]!;
    const columns=table.fieldOrder.map((id,index)=>({id,index})).filter(({id})=>!table.fields[id]!.system);
    if(table.fieldOrder.some((id,c)=>original.cellData?.[0]?.[c]?.v!==table.fields[id]!.name))throw new OfficeError('BASE_EXPORT_COLUMNS','SDK column layout differs from the selected table.');
    const cellData:NonNullable<typeof original.cellData>={};
    for(let row=0;row<=(table.recordOrder?.length??0);row++){
      cellData[row]={};
      columns.forEach(({id,index},c)=>{
        const cell=original.cellData?.[row]?.[index];
        if(cell){
          const {f,si,...value}=cell;
          if(f&&value.v==null)throw new OfficeError('BASE_FORMULA_RESULT_MISSING','Formula has no cached result.');
          const sourceCell=row>0?table.cellData?.[row-1]?.[index]:undefined;
          // This Exchange cohort round-trips numeric Base fields as text; preserve their typed value.
          if(['number','formula'].includes(table.fields[id]!.type)&&typeof sourceCell?.v==='number'){value.v=sourceCell.v;value.t=2;delete value.p;}
          cellData[row]![c]=value;
        }
      });
    }
    // A fresh workbook excludes hidden columns, source table metadata and other Base resources.
    const sheet={id:converted.sheetOrder[0]!,name:table.name,rowCount:Math.max(1,(table.recordOrder?.length??0)+1),columnCount:columns.length,cellData};
    const workbook={id:converted.id,name:selected.name,appVersion:converted.appVersion,locale:converted.locale,styles:converted.styles,sheetOrder:[sheet.id],sheets:{[sheet.id]:sheet}} as IWorkbookData;
    bytes=extension==='xlsx'?await exportToBuffer(workbook,{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX}):await exportToBuffer(workbook,{type:UniverInstanceType.UNIVER_SHEET,format:extension==='csv'?ExchangeFormat.CSV:ExchangeFormat.TSV,csv:{worksheetId:sheet.id}});
  }
  else if(kind==='sheet'&&extension==='xlsx')bytes=await exportToBuffer(data as IWorkbookData,{type:UniverInstanceType.UNIVER_SHEET,format:ExchangeFormat.XLSX});
  else if(kind==='sheet'&&(extension==='csv'||extension==='tsv'))bytes=await exportToBuffer(data as IWorkbookData,{type:UniverInstanceType.UNIVER_SHEET,format:extension==='csv'?ExchangeFormat.CSV:ExchangeFormat.TSV,csv:{worksheetId:(data as IWorkbookData).sheetOrder[0]!}});
  else if(kind==='doc'&&extension==='docx')bytes=await exportToBuffer(data as IDocumentData,{type:UniverInstanceType.UNIVER_DOC,format:ExchangeFormat.DOCX});
  else if(kind==='slide'&&extension==='pptx')bytes=await exportToBuffer(data as ISlideData,{type:UniverInstanceType.UNIVER_SLIDE,format:ExchangeFormat.PPTX});
  else throw new OfficeError('UNSUPPORTED_EXPORT',`Unsupported ${kind} export extension: ${extension}`);
  return publish(output,bytes);
}
export class VisualDelivery{
  private runtime:Awaited<ReturnType<typeof createUniverRenderRuntime>>|undefined;
  async getRuntime(){return this.runtime??=await createUniverRenderRuntime({renderPageRoot:fileURLToPath(new URL('../render-page',import.meta.url)),license:process.env.UNIVER_LICENSE,browserExecutablePath:process.env.UNIVER_RENDER_BROWSER});}
  async screenshot(unit:UniverRenderUnit,target?:UnitScreenshotInput['target']){
    const result=await createUnitScreenshot({runtime:await this.getRuntime(),limits:{maxPages:30,maxPixels:16777216}}).capture({...unit,target} as UnitScreenshotInput);
    if(result.images.reduce((total,image)=>total+image.width*image.height,0)>67108864)throw new OfficeError('PIXEL_LIMIT','Screenshot batch exceeds 67,108,864 pixels.');
    return result;
  }
  async pdf(unit:UniverRenderUnit,output:string){if(unit.unitType==='base')throw new OfficeError('UNSUPPORTED_PRINT','Base PDF is unsupported.');const result=await createUnitPdfPrinter({runtime:await this.getRuntime(),maxPages:30}).print(unit);return {...await publish(output,result.bytes),pageCount:result.pageCount};}
  async lint(unit:UniverRenderUnit,pages?:(number|string)[]){if(unit.unitType!=='slide')throw new OfficeError('UNSUPPORTED_LINT','Layout lint supports Slide only.');return createUnitLayoutLint({runtime:await this.getRuntime()}).lint({...unit,pages});}
  async close(){await this.runtime?.close();this.runtime=undefined;}
}
