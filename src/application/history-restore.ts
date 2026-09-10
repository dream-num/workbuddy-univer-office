import {randomUUID} from 'node:crypto';
import type {IChangeset} from '@univerjs/protocol';
import type {Office} from './office.js';
import {protocolTypes} from './office.js';
import type {Principal} from '../storage/file-context.js';
import {OfficeError,requireValue} from '../shared/contracts.js';

interface RestoreIntent {
  operationId:string;fileId:string;unitId:string;targetRevision:number;expectedRevision:number;
  createdAt:number;status:'prepared'|'submitting'|'completed'|'cancelled';request:IChangeset;resultRevision?:number;
}
const context={userID:'application',memberID:'history-review'};
/** Call inside Office.serial(), shared with other application writes. */
export async function prepareHistoryRestore(office:Office,fileId:string,unitId:string,targetRevision:number,principal:Principal){
  office.requireTrunkEdit(principal,fileId,unitId);
  const {file,unit}=await office.resolveTarget({fileId,unitId,branch:'trunk'});
  const head=await file.service.getUnitLoadData({unitID:unitId,type:protocolTypes[unit.kind],revision:0},context);
  requireValue(Number.isSafeInteger(targetRevision)&&targetRevision>=1&&targetRevision<head.targetRevision,'INVALID_HISTORY_REVISION','Select an earlier confirmed version.');
  await file.service.getUnitLoadData({unitID:unitId,type:protocolTypes[unit.kind],revision:targetRevision},context);
  const operationId=randomUUID();
  const intent:RestoreIntent={operationId,fileId,unitId,targetRevision,expectedRevision:head.targetRevision,createdAt:Date.now(),status:'prepared',request:{unitID:unitId,type:protocolTypes[unit.kind],baseRev:head.targetRevision,revision:0,userID:context.userID,memberID:context.memberID,sid:`restore:${operationId}`,reqId:1,mutations:[{id:'univer.mutation.revert-version',data:JSON.stringify({unitId,revision:targetRevision})}]}};
  file.catalog.put('history-restore',operationId,intent);
  return {operationId,fileId,unitId,unitName:unit.name,targetRevision,expectedRevision:intent.expectedRevision};
}
export async function confirmHistoryRestore(office:Office,fileId:string,operationId:string,principal:Principal){
  const file=office.file(fileId),intent=file.catalog.get<RestoreIntent>('history-restore',operationId);
  requireValue(intent&&intent.fileId===fileId,'RESTORE_NOT_FOUND','Prepare the selected version before restoring.');
  office.requireTrunkEdit(principal,fileId,intent.unitId);
  requireValue(intent.status!=='cancelled','RESTORE_CANCELLED','This restore was cancelled. Prepare a new operation.');
  const result=()=>({operationId,fileId,unitId:intent.unitId,targetRevision:intent.targetRevision,revision:intent.resultRevision!,outcome:'completed' as const});
  if(intent.status==='completed')return result();
  await office.resolveTarget({fileId,unitId:intent.unitId,branch:'trunk'});
  const head=await file.service.getUnitLoadData({unitID:intent.unitId,type:intent.request.type,revision:0},context);
  if(intent.status==='submitting'&&head.targetRevision>intent.expectedRevision){
    // Recover a confirmed SDK write if the process died before persisting its receipt.
    const confirmed=await file.service.getChangesets({unitID:intent.unitId,type:intent.request.type,from:intent.expectedRevision,to:head.targetRevision},context);
    const match=confirmed.changesets.find(c=>c.sid===intent.request.sid&&c.reqId===intent.request.reqId);
    if(match){intent.status='completed';intent.resultRevision=match.revision;file.catalog.put('history-restore',operationId,intent);return result();}
  }
  requireValue(head.targetRevision===intent.expectedRevision,'STALE_REVIEW','The current version changed. Review and prepare again.');
  requireValue(intent.status==='submitting'||Date.now()-intent.createdAt<15*60_000,'RESTORE_EXPIRED','The review expired. Prepare again.');
  intent.status='submitting';file.catalog.put('history-restore',operationId,intent);
  const submitted=await file.service.submitChangeset({changeset:intent.request},context);
  if(submitted.status!=='committed'&&submitted.status!=='already-committed')throw new OfficeError('RESTORE_UNCONFIRMED','Restore was not confirmed. Retry this same operation.');
  intent.status='completed';intent.resultRevision=submitted.changeset.revision;
  file.catalog.put('history-restore',operationId,intent);return result();
}

export async function cancelHistoryRestore(office:Office,fileId:string,operationId:string,principal:Principal){
  const file=office.file(fileId),intent=file.catalog.get<RestoreIntent>('history-restore',operationId);
  requireValue(intent&&intent.fileId===fileId,'RESTORE_NOT_FOUND','Restore operation unavailable.');
  office.requireTrunkEdit(principal,fileId,intent.unitId);
  requireValue(intent.status==='prepared'||intent.status==='cancelled','RESTORE_NOT_CANCELLABLE','The restore was already submitted. Retry the same operation to check its result.');
  intent.status='cancelled';file.catalog.put('history-restore',operationId,intent);
  return {operationId,outcome:'cancelled' as const};
}
