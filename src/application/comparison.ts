import {randomUUID} from 'node:crypto';
import {UniverInstanceType} from '@univerjs/core';
import {createUnitComparisonEngine,UnitComparisonFidelity,type IPreparedUnitComparison,type IUnitComparisonResult} from '@univerjs-pro/edit-history';
import {SheetsUnitComparisonAdapter} from '@univerjs-pro/sheets-history';
import {DocsUnitComparisonAdapter} from '@univerjs-pro/docs-history';
import {SlidesUnitComparisonAdapter} from '@univerjs-pro/slides-history';
import {BasesUnitComparisonAdapter} from '@univerjs-pro/bases-history';
import {BoardsUnitComparisonAdapter} from '@univerjs-pro/boards-history';
import {OfficeError} from '../shared/contracts.js';
import type {Office} from './office.js';
import type {Target,UnitKind} from '../shared/contracts.js';

export interface ComparisonSnapshot {unitData:unknown;revision:number}
export interface ComparisonRecord {
  comparisonId:string;kind:UnitKind;rightTarget:Target;leftTarget:Target|null;
  left:ComparisonSnapshot;right:ComparisonSnapshot;createdAt:string;result:IUnitComparisonResult;
}
const engine=createUnitComparisonEngine([new SheetsUnitComparisonAdapter(),new DocsUnitComparisonAdapter(),new SlidesUnitComparisonAdapter(),new BasesUnitComparisonAdapter(),new BoardsUnitComparisonAdapter()]);
const types={sheet:UniverInstanceType.UNIVER_SHEET,doc:UniverInstanceType.UNIVER_DOC,slide:UniverInstanceType.UNIVER_SLIDE,base:UniverInstanceType.UNIVER_BASE,board:UniverInstanceType.UNIVER_BOARD} as const;
export function compare(kind:UnitKind,rightTarget:Target,leftTarget:Target|null,left:ComparisonSnapshot,right:ComparisonSnapshot):ComparisonRecord{
  const comparisonId=randomUUID();
  const result=engine.compare({comparisonId,unitId:rightTarget.unitId,type:types[kind],fidelity:UnitComparisonFidelity.SNAPSHOT,
    leftData:left.unitData,rightData:right.unitData,query:{limit:1000}});
  return{comparisonId,kind,leftTarget,rightTarget,left,right,createdAt:new Date().toISOString(),result};
}

/** Reuse the public SDK's prepared result; rebuild only from persisted fixed snapshots after eviction/restart. */
export class ComparisonPages {
  private prepared=new Map<string,IPreparedUnitComparison>();
  query(record:ComparisonRecord,offset:number,contextOffset:number):IUnitComparisonResult {
    const key=`${record.rightTarget.fileId}:${record.comparisonId}`;
    let prepared=this.prepared.get(key);
    if(!prepared){
      prepared=engine.prepare({comparisonId:record.comparisonId,unitId:record.rightTarget.unitId,type:types[record.kind],
        fidelity:UnitComparisonFidelity.SNAPSHOT,leftData:record.left.unitData,rightData:record.right.unitData});
      // Bound resident prepared comparisons. Catalog snapshots remain the source of truth.
      if(this.prepared.size>=4)this.prepared.delete(this.prepared.keys().next().value!);
      this.prepared.set(key,prepared);
    }
    return engine.query(prepared,{offset,contextOffset,limit:1000,contextLimit:1000});
  }
}

export async function comparisonHeads(office:Office,record:Pick<ComparisonRecord,'leftTarget'|'rightTarget'>){
  const read=async(target:Target|null)=>{
    if(!target)return 0;
    const {file,unit}=await office.resolveTarget(target);
    if(target.branch==='worktree'){
      const {worktree}=await file.worktrees.getWorktree({worktreeID:target.worktreeId!},{userID:'application'});
      if(!['draft','ready','merging'].includes(worktree.status))throw new OfficeError('COMPARISON_SOURCE_CLOSED','A compared draft was merged or discarded. Open the saved content.',409);
      return worktree.units.find(u=>u.unitID===target.unitId)!.draftHeadRevision;
    }
    const load=await file.service.getUnitLoadData({unitID:unit.unitId,type:types[unit.kind],revision:0},{userID:'application'});
    return load.targetRevision;
  };
  return {left:await read(record.leftTarget),right:await read(record.rightTarget)};
}
