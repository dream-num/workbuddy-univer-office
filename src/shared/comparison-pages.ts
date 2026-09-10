import type {IUnitComparisonResult} from '@univerjs-pro/edit-history';

const alignment=(result:IUnitComparisonResult)=>result.productContext&&'paragraphAlignment' in result.productContext?result.productContext:undefined;

/** Drain both SDK page streams before presenting searchable, complete fixed-version changes. */
export async function completeComparison(initial:IUnitComparisonResult,read:(offset:number,contextOffset:number)=>Promise<IUnitComparisonResult>,progress?:(loaded:number,total:number)=>void):Promise<IUnitComparisonResult>{
  let page=initial;
  const items=[...initial.items],rows=[...(alignment(initial)?.paragraphAlignment??[])];
  const ids=new Set(items.map(item=>item.id));
  const total=initial.page.matched,contextTotal=alignment(initial)?.paragraphAlignmentPage?.matched??rows.length;
  while(page.page.hasMore||alignment(page)?.paragraphAlignmentPage?.hasMore){
    progress?.(items.length+rows.length,total+contextTotal);
    const offset=items.length,contextOffset=rows.length;
    const next=await read(offset,contextOffset),context=alignment(next);
    if(next.comparisonId!==initial.comparisonId||next.page.offset!==offset||next.page.matched!==total||
      (context?.paragraphAlignmentPage&&(context.paragraphAlignmentPage.offset!==contextOffset||context.paragraphAlignmentPage.matched!==contextTotal)))throw new Error('对比分页与固定版本不一致，请重新打开对比。');
    if((page.page.hasMore&&!next.items.length)||(alignment(page)?.paragraphAlignmentPage?.hasMore&&!context?.paragraphAlignment.length))throw new Error('对比分页未返回后续内容，请重试。');
    for(const item of next.items){if(ids.has(item.id))throw new Error('对比分页包含重复内容，请重试。');ids.add(item.id);items.push(item);}
    rows.push(...(context?.paragraphAlignment??[]));
    if(items.length>total||rows.length>contextTotal)throw new Error('对比分页数量超出固定版本，请重试。');
    page=next;
  }
  if(items.length!==total||rows.length!==contextTotal)throw new Error('对比分页不完整，请重试。');
  progress?.(items.length+rows.length,total+contextTotal);
  const context=alignment(initial);
  return {...initial,items,page:{...initial.page,offset:0,limit:items.length,hasMore:false},
    ...(context?{productContext:{...context,paragraphAlignment:rows,paragraphAlignmentPage:{offset:0,limit:rows.length,matched:rows.length,hasMore:false}}}:{})};
}
