import { createStandardHeadlessUniverFactory } from '@univer-cli/headless-univer';
import { createCollaborationServerAdapter, createUniverCollaborationRuntimeFactory } from '@univer-cli/univer-collaboration-runtime';
import { prepareContentExecutionProgram } from '@univer-cli/content-execution';
import { inspectContent, type ContentInspectionQuery } from '@univer-cli/content-inspection';
import { UniverInstanceType, BooleanNumber, type IBaseSnapshot, type IWorkbookData } from '@univerjs/core';
import {selectBaseExport,type BaseSelection,type BaseProjection} from '../application/base-export.js';
import { collaborationUrls } from '../shared/urls.js';
import type { Target, UnitKind } from '../shared/contracts.js';
import './sheet-export-facade.js';

export interface ContentJob {
  origin: string; credential: string; target: Target; kind: UnitKind;
  action: 'execute'|'snapshot'|'inspect'|'base-export'|'sheet-export'; mode: 'read'|'write'; code?: string; query?: ContentInspectionQuery; baseSelection?:BaseSelection;
}
const types = {sheet:UniverInstanceType.UNIVER_SHEET,doc:UniverInstanceType.UNIVER_DOC,slide:UniverInstanceType.UNIVER_SLIDE,base:UniverInstanceType.UNIVER_BASE,board:UniverInstanceType.UNIVER_BOARD};
async function run(job: ContentJob) {
  const urls = collaborationUrls(job.origin, job.target.fileId, job.target.worktreeId);
  const factory = createUniverCollaborationRuntimeFactory({
    backend: createCollaborationServerAdapter({...urls, httpRequest: (input, init) => {
      const headers = new Headers(init?.headers); headers.set('Authorization', `Bearer ${job.credential}`);
      return fetch(input, {...init,headers});
    }}),
    createUniver: createStandardHeadlessUniverFactory({license:process.env.UNIVER_LICENSE ?? ''}),
  });
  const runtime = await factory.load(job.target.unitId, types[job.kind]);
  try {
    const pulled = await runtime.pull();
    if (pulled.status === 'conflict') throw new Error(pulled.conflict.message);
    if(job.action==='sheet-export'){
      if(job.kind!=='sheet')throw new Error('Sheet export requires a workbook.');
      const revision=runtime.getState().baseRevision;
      const code=prepareContentExecutionProgram({unitId:job.target.unitId,unitType:'sheet',code:`
        return workbook.getSheets().map(sheet=>({id:sheet.getSheetId(),rows:sheet.getFilter()?.getFilteredOutRows()??[]}));
      `});
      const filters=(await runtime.execute({mode:'read',code})).value as unknown as {id:string;rows:number[]}[];
      const data=structuredClone(await runtime.exportUnitData()) as IWorkbookData;
      const themeResource=data.resources?.find(resource=>resource.name==='SHEET_RANGE_THEME_MODEL_PLUGIN');
      if(themeResource){
        const themes=JSON.parse(themeResource.data);
        const names=[...new Set(Object.values(themes.rangeThemeStyleRuleMap??{}).map(rule=>(rule as {themeName:string}).themeName))];
        if(names.length){
          const themeCode=prepareContentExecutionProgram({unitId:job.target.unitId,unitType:'sheet',code:`return workbook.getOfficeExportThemes(${JSON.stringify(names)});`});
          themes.rangeThemeStyleMapJson={...themes.rangeThemeStyleMapJson,...(await runtime.execute({mode:'read',code:themeCode})).value as object};
          themeResource.data=JSON.stringify(themes);
        }
      }
      if(runtime.getState().baseRevision!==revision)throw new Error('Sheet changed during export; retry the read.');
      // Excel stores the current auto-filter result as row visibility as well as
      // filter criteria. Project into delivery data only; never hide source rows.
      for(const filter of filters){
        const sheet=data.sheets[filter.id];
        if(!sheet)throw new Error('Filtered worksheet missing from export.');
        sheet.rowData??={};
        for(const row of filter.rows)sheet.rowData[row]={...sheet.rowData[row],hd:BooleanNumber.TRUE};
      }
      return {unitData:data,revision};
    }
    if(job.action==='base-export'){
      if(job.kind!=='base'||!job.baseSelection)throw new Error('Base selection is required.');
      const revision=runtime.getState().baseRevision;
      let projection:BaseProjection|undefined;
      if(job.baseSelection.viewId){
        const code=prepareContentExecutionProgram({unitId:job.target.unitId,unitType:'base',code:`
          const table=base.getTableById(${JSON.stringify(job.baseSelection.tableId)});
          if(!table)throw new Error('Selected Base table does not exist.');
          const view=table.getViewById(${JSON.stringify(job.baseSelection.viewId)});
          if(!view)throw new Error('Selected view does not belong to the table.');
          const projection=view.getProjection();
          return {fieldIds:view.getVisibleFields().map(f=>f.getId()),recordIds:projection.rows.map(r=>r.recordId)};
        `});
        projection=(await runtime.execute({mode:'read',code})).value as unknown as BaseProjection;
      }
      const data=await runtime.exportUnitData() as IBaseSnapshot;
      if(runtime.getState().baseRevision!==revision)throw new Error('Base changed during export; retry the read.');
      return {...selectBaseExport(data,job.baseSelection,projection),revision};
    }
    if (job.action === 'snapshot') return {unitData:await runtime.exportUnitData(),revision:runtime.getState().baseRevision};
    if (job.action === 'inspect') return await inspectContent({unitId:job.target.unitId,unitType:job.kind,execute:input => runtime.execute(input)},job.query!);
    const code=prepareContentExecutionProgram({unitId:job.target.unitId,unitType:job.kind,code:job.code!});
    const execution = job.mode==='read'?await runtime.execute({mode:'read',code}):await runtime.execute({mode:'write',code});
    if (job.mode === 'read') return {outcome:'completed',value:execution.value,mutations:0};
    let commit = await runtime.commit();
    for (let attempt=0; attempt<2 && ['pull-required','retry','unknown'].includes(commit.status); attempt++) {
      if (commit.status === 'pull-required') {
        const pull = await runtime.pull(); if (pull.status === 'conflict') throw new Error(pull.conflict.message);
      }
      // Retry the same pending submission, never execute the original program twice.
      commit = await runtime.commit();
    }
    return {outcome:['confirmed','nothing-to-commit'].includes(commit.status)?'completed':'unknown',commit:commit.status,
      ...('changeset' in commit?{pendingSubmission:commit.changeset}:{}),...('conflict' in commit?{conflict:commit.conflict}:{}),
      revision:commit.state.baseRevision,value:execution.value,mutations:'mutations' in execution&&Array.isArray(execution.mutations)?execution.mutations.length:0};
  } finally { await runtime.close(); }
}
process.once('message', async (job: ContentJob) => {
  // Large snapshots can exceed the IPC pipe buffer. Disconnect only after the send callback.
  const reply=(message:unknown)=>new Promise<void>((resolve,reject)=>{
    process.send!(message,undefined,undefined,error=>error?reject(error):resolve());
  });
  try { const value = await run(job); await reply({ok:true,value}); }
  catch (error) { await reply({ok:false,error:error instanceof Error?error.message:String(error)}); }
  finally { if(process.connected)process.disconnect(); }
});
