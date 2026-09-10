import {createPresetRenderUniver,mountUniverRenderPage} from '@univer-cli/univer-render-page';
// Let the entry module finish evaluating before the SDK loads its Facade chunks.
// A top-level await can deadlock when Rollup moves shared exports into this entry.
void mountUniverRenderPage({container:document.querySelector<HTMLElement>('#app')!,createUniver:createPresetRenderUniver})
  .catch(error=>{console.error('Univer Render Page initialization failed',error);throw error;});
