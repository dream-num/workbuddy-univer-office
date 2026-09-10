import type {IPreset} from '@univerjs/presets';
import historyWorkerUrl from './history-worker.ts?worker&url';
import type {UnitKind} from '../shared/contracts.js';
import {UniverEditHistoryPlugin} from '@univerjs-pro/edit-history';
import HistoryZh from '@univerjs-pro/edit-history-ui/locale/zh-CN';
import '@univerjs-pro/edit-history-ui/lib/index.css';
import {UniverSheetsHistoryPlugin} from '@univerjs-pro/sheets-history';
import {ToggleEditHistoryOperation,UniverSheetsHistoryUIPlugin} from '@univerjs-pro/sheets-history-ui';
import SheetsHistoryZh from '@univerjs-pro/sheets-history-ui/locale/zh-CN';
import '@univerjs-pro/sheets-history-ui/lib/index.css';
import {UniverDocsHistoryPlugin} from '@univerjs-pro/docs-history';
import {UniverDocsHistoryUIPlugin} from '@univerjs-pro/docs-history-ui';
import DocsHistoryZh from '@univerjs-pro/docs-history-ui/locale/zh-CN';
import {UniverSlidesHistoryPlugin} from '@univerjs-pro/slides-history';
import {UniverSlidesHistoryUIPlugin} from '@univerjs-pro/slides-history-ui';
import SlidesHistoryZh from '@univerjs-pro/slides-history-ui/locale/zh-CN';
import {UniverBasesHistoryPlugin} from '@univerjs-pro/bases-history';
import {UniverBasesHistoryUIPlugin} from '@univerjs-pro/bases-history-ui';
import BasesHistoryZh from '@univerjs-pro/bases-history-ui/locale/zh-CN';
import '@univerjs-pro/bases-history-ui/lib/index.css';
import {UniverBoardsHistoryPlugin} from '@univerjs-pro/boards-history';
import {UniverBoardsHistoryUIPlugin} from '@univerjs-pro/boards-history-ui';
import BoardsHistoryZh from '@univerjs-pro/boards-history-ui/locale/zh-CN';
import '@univerjs-pro/boards-history-ui/lib/index.css';

export const historyLocales=[HistoryZh,SheetsHistoryZh,DocsHistoryZh,SlidesHistoryZh,BasesHistoryZh,BoardsHistoryZh];
// Product operation IDs verified in the installed SDK cohort. Their operation
// declarations are shipped, but only Sheets re-exports its constant at package root.
export const historyOperationIds:Record<UnitKind,string>={
  sheet:ToggleEditHistoryOperation.id,
  doc:'docs-history-ui.operation.open',
  slide:'slides-history-ui.operation.open',
  base:'bases-history-ui.operation.open',
  board:'boards-history-ui.operation.open',
};
export function historyPlugins(kind:UnitKind,historyServerUrl:string):IPreset['plugins']{
  const config={historyServerUrl,univerContainerId:'editor',...(kind==='sheet'?{workerURL:historyWorkerUrl}:{})};
  const models={sheet:UniverSheetsHistoryPlugin,doc:UniverDocsHistoryPlugin,slide:UniverSlidesHistoryPlugin,base:UniverBasesHistoryPlugin,board:UniverBoardsHistoryPlugin};
  const views={sheet:UniverSheetsHistoryUIPlugin,doc:UniverDocsHistoryUIPlugin,slide:UniverSlidesHistoryUIPlugin,base:UniverBasesHistoryUIPlugin,board:UniverBoardsHistoryUIPlugin};
  return [[UniverEditHistoryPlugin,{historyServerUrl}],models[kind],[views[kind],config]];
}
