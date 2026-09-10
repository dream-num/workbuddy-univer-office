import type {HistoryChangeKind} from '@univerjs-pro/edit-history';
export interface ComparisonRange {kind:HistoryChangeKind;startRow:number;endRow:number;startColumn:number;endColumn:number}

/** Merge rectangles only across identical spans, preserving every hole and change color. */
export function compactComparisonRanges(input:readonly ComparisonRange[]):ComparisonRange[]{
  const horizontal=[...input].sort((a,b)=>a.kind.localeCompare(b.kind)||a.startRow-b.startRow||a.endRow-b.endRow||a.startColumn-b.startColumn);
  const rows:ComparisonRange[]=[];
  for(const range of horizontal){
    const previous=rows.at(-1);
    if(previous&&previous.kind===range.kind&&previous.startRow===range.startRow&&previous.endRow===range.endRow&&range.startColumn<=previous.endColumn+1)previous.endColumn=Math.max(previous.endColumn,range.endColumn);
    else rows.push({...range});
  }
  rows.sort((a,b)=>a.kind.localeCompare(b.kind)||a.startColumn-b.startColumn||a.endColumn-b.endColumn||a.startRow-b.startRow);
  const result:ComparisonRange[]=[];
  for(const range of rows){
    const previous=result.at(-1);
    if(previous&&previous.kind===range.kind&&previous.startColumn===range.startColumn&&previous.endColumn===range.endColumn&&range.startRow<=previous.endRow+1)previous.endRow=Math.max(previous.endRow,range.endRow);
    else result.push({...range});
  }
  return result;
}
