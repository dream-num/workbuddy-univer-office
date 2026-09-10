import type {IBaseSnapshot, ITableSnapshot} from '@univerjs/core';
import {OfficeError} from '../shared/contracts.js';

export interface BaseSelection {tableId:string;viewId?:string}
export interface BaseProjection {fieldIds:string[];recordIds:string[]}

/** Build an isolated Exchange input; never mutate the collaborative source. */
export function selectBaseExport(source:IBaseSnapshot,selection:BaseSelection,projection?:BaseProjection){
  const original=source.tables[selection.tableId];
  if(!original)throw new OfficeError('BASE_TABLE_NOT_FOUND','Selected Base table does not exist.');
  if(selection.viewId&&!original.views[selection.viewId])throw new OfficeError('BASE_VIEW_NOT_FOUND','Selected view does not belong to the table.');
  if(selection.viewId&&!projection)throw new OfficeError('BASE_PROJECTION_REQUIRED','View export requires a confirmed SDK projection.');
  const fieldIds=projection?.fieldIds??original.fieldOrder.filter(id=>!original.fields[id]?.system);
  const recordIds=projection?.recordIds??original.recordOrder??Object.keys(original.records);
  if(!fieldIds.length)throw new OfficeError('BASE_NO_VISIBLE_FIELDS','Selected view has no visible fields.');
  if(fieldIds.some(id=>!original.fields[id]||original.fields[id]!.system)||recordIds.some(id=>!original.records[id]))throw new OfficeError('BASE_PROJECTION_INVALID','Projection does not match the selected snapshot.');
  const unsupported=fieldIds.filter(id=>!['text','number','formula'].includes(original.fields[id]!.type));
  if(unsupported.length)throw new OfficeError('BASE_FIELD_EXPORT_UNVERIFIED',`Export representation is not yet verified for fields: ${unsupported.map(id=>original.fields[id]!.name).join(', ')}.`);
  // Exchange requires system identity fields; delivery removes them after native conversion.
  const storageFieldIds=[...original.fieldOrder.filter(id=>original.fields[id]?.system),...fieldIds];
  const table:ITableSnapshot={...structuredClone(original),fields:{},fieldOrder:[...storageFieldIds],records:{},recordOrder:[...recordIds],rowIndex:{},rowId:{},colIndex:{},colId:{},cellData:{},views:{},viewOrder:[],primaryFieldId:fieldIds.includes(original.primaryFieldId)?original.primaryFieldId:fieldIds[0]!};
  storageFieldIds.forEach((id,c)=>{table.fields[id]=structuredClone(original.fields[id]!);table.colIndex![id]=c;table.colId![c]=id;});
  recordIds.forEach((id,r)=>{
    const record=original.records[id]!;
    table.records[id]={...structuredClone(record),orderKey:String(r).padStart(12,'0'),values:Object.fromEntries(storageFieldIds.map(f=>[f,record.values[f]??null]))};
    table.rowIndex![id]=r;table.rowId![r]=id;table.cellData![r]={};
    storageFieldIds.forEach((fieldId,c)=>{
      const oldRow=original.rowIndex?.[id],oldCol=original.colIndex?.[fieldId];
      const cell=oldRow===undefined||oldCol===undefined?undefined:original.cellData?.[oldRow]?.[oldCol];
      if(original.fields[fieldId]!.type==='formula'&&cell?.v==null)throw new OfficeError('BASE_FORMULA_RESULT_MISSING',`Formula result is unavailable for field ${original.fields[fieldId]!.name}, record ${id}. Calculate and confirm the source before exporting.`);
      if(cell)table.cellData![r]![c]=structuredClone(cell);
    });
  });
  return {unitData:{...structuredClone(source),tables:{[table.id]:table},tableOrder:[table.id]},selection,fieldIds,recordCount:recordIds.length};
}
