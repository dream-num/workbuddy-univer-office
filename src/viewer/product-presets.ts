import {IImageIoService} from '@univerjs/core';
import {UniverRenderEnginePlugin} from '@univerjs/engine-render';
import {UniverNetworkPlugin} from '@univerjs/network';
import {UniverUIPlugin} from '@univerjs/ui';
import {UniverDocsPlugin} from '@univerjs/docs';
import {UniverDocsUIPlugin} from '@univerjs/docs-ui';
import {UniverDocsDrawingPlugin} from '@univerjs/docs-drawing';
import {UniverDocsDrawingUIPlugin} from '@univerjs/docs-drawing-ui';
import {UniverDocsChartPlugin} from '@univerjs-pro/docs-chart';
import {UniverDocsChartUIPlugin} from '@univerjs-pro/docs-chart-ui';
import {UniverDrawingUIPlugin} from '@univerjs/drawing-ui';
import DocsDrawingUIZh from '@univerjs/docs-drawing-ui/locale/zh-CN';
import DocsChartUIZh from '@univerjs-pro/docs-chart-ui/locale/zh-CN';
import '@univerjs/docs-drawing/facade';
import '@univerjs-pro/docs-chart/facade';
import '@univerjs/docs-drawing-ui/lib/index.css';
import '@univerjs-pro/docs-chart-ui/lib/index.css';
import {UniverDrawingPlugin} from '@univerjs/drawing';
import {UniverSlidesPlugin} from '@univerjs-pro/slides';
import {UniverSlidesUIPlugin} from '@univerjs-pro/slides-ui';
import {UniverBasesPlugin} from '@univerjs-pro/bases';
import {UniverBasesUIPlugin} from '@univerjs-pro/bases-ui';
import {IAttachmentIoService} from '@univerjs-pro/collaboration-client';
import {UniverBoardsPlugin} from '@univerjs-pro/boards';
import {UniverBoardsUIPlugin} from '@univerjs-pro/boards-ui';
import {UniverProFormulaEnginePlugin} from '@univerjs-pro/engine-formula';
import {UniverSheetsCorePreset} from '@univerjs/preset-sheets-core';
import {UniverSheetsFilterPlugin} from '@univerjs/sheets-filter';
import {UniverSheetsFilterUIPlugin} from '@univerjs/sheets-filter-ui';
import {UniverSheetsSortPlugin} from '@univerjs/sheets-sort';
import {UniverSheetsSortUIPlugin} from '@univerjs/sheets-sort-ui';
import {UniverSheetsTablePlugin} from '@univerjs/sheets-table';
import {UniverSheetsTableUIPlugin} from '@univerjs/sheets-table-ui';
import SheetsFilterZh from '@univerjs/sheets-filter/locale/zh-CN';
import SheetsFilterUIZh from '@univerjs/sheets-filter-ui/locale/zh-CN';
import SheetsSortUIZh from '@univerjs/sheets-sort-ui/locale/zh-CN';
import SheetsTableZh from '@univerjs/sheets-table/locale/zh-CN';
import SheetsTableUIZh from '@univerjs/sheets-table-ui/locale/zh-CN';
import '@univerjs/sheets-filter/facade';
import '@univerjs/sheets-sort/facade';
import '@univerjs/sheets-table/facade';
import '@univerjs/sheets-filter-ui/lib/index.css';
import '@univerjs/sheets-sort-ui/lib/index.css';
import '@univerjs/sheets-table-ui/lib/index.css';
import {UniverSheetsConditionalFormattingPreset} from '@univerjs/preset-sheets-conditional-formatting';
import {UniverSheetsDataValidationPreset} from '@univerjs/preset-sheets-data-validation';
import {UniverSheetsDrawingPreset} from '@univerjs/preset-sheets-drawing';
import {UniverSheetsChartPlugin} from '@univerjs-pro/sheets-chart';
import {UniverSheetsChartUIPlugin} from '@univerjs-pro/sheets-chart-ui';
import {UniverSheetsPivotTablePlugin} from '@univerjs-pro/sheets-pivot';
import {UniverSheetsPivotTableUIPlugin} from '@univerjs-pro/sheets-pivot-ui';
import SheetsPivotZh from '@univerjs-pro/sheets-pivot/locale/zh-CN';
import SheetsPivotUIZh from '@univerjs-pro/sheets-pivot-ui/locale/zh-CN';
import '@univerjs-pro/sheets-pivot/facade';
import '@univerjs-pro/sheets-pivot-ui/lib/index.css';
import SheetsDrawingZh from '@univerjs/preset-sheets-drawing/locales/zh-CN';
import SheetsChartZh from '@univerjs-pro/sheets-chart/locale/zh-CN';
import SheetsChartUIZh from '@univerjs-pro/sheets-chart-ui/locale/zh-CN';
import ChartUIZh from '@univerjs-pro/chart-ui/locale/zh-CN';
import '@univerjs-pro/sheets-chart/facade';
import '@univerjs-pro/chart-ui/facade';
import '@univerjs/preset-sheets-drawing/lib/index.css';
import '@univerjs-pro/sheets-chart-ui/lib/index.css';
import '@univerjs-pro/chart-ui/lib/index.css';
import ConditionalFormattingZh from '@univerjs/preset-sheets-conditional-formatting/locales/zh-CN';
import DataValidationZh from '@univerjs/preset-sheets-data-validation/locales/zh-CN';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import {UniverFormulaEnginePlugin} from '@univerjs/preset-docs-core';
import type {IPreset} from '@univerjs/presets';
import type {UnitKind} from '../shared/contracts.js';
import DesignZh from '@univerjs/design/locale/zh-CN';
import UIZh from '@univerjs/ui/locale/zh-CN';
import DocsUIZh from '@univerjs/docs-ui/locale/zh-CN';
import DrawingUIZh from '@univerjs/drawing-ui/locale/zh-CN';
import SlidesZh from '@univerjs-pro/slides/locale/zh-CN';
import SlidesUIZh from '@univerjs-pro/slides-ui/locale/zh-CN';
import BasesZh from '@univerjs-pro/bases/locale/zh-CN';
import BasesUIZh from '@univerjs-pro/bases-ui/locale/zh-CN';
import BoardsUIZh from '@univerjs-pro/boards-ui/locale/zh-CN';
import '@univerjs-pro/slides/facade';
import '@univerjs-pro/bases/facade';
import '@univerjs-pro/boards/facade';
import '@univerjs-pro/slides-ui/lib/index.css';
import '@univerjs-pro/bases-ui/lib/index.css';
import '@univerjs-pro/boards-ui/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/drawing-ui/lib/index.css';

export const productLocales=[DesignZh,UIZh,DocsUIZh,DrawingUIZh,DocsDrawingUIZh,DocsChartUIZh,SlidesZh,SlidesUIZh,BasesZh,BasesUIZh,BoardsUIZh,ConditionalFormattingZh,DataValidationZh,SheetsDrawingZh,SheetsChartZh,SheetsChartUIZh,ChartUIZh,SheetsPivotZh,SheetsPivotUIZh,SheetsFilterZh,SheetsFilterUIZh,SheetsSortUIZh,SheetsTableZh,SheetsTableUIZh];
export function productPreset(kind:UnitKind,container='editor',collaboration=false,editing=false):IPreset{
  // Ribbon is available only while editing a confirmed, merged trunk version.
  const workbench={container,header:editing,toolbar:editing};
  if(kind==='sheet')return{plugins:[
    ...UniverSheetsCorePreset(workbench).plugins,
    UniverSheetsFilterPlugin,
    UniverSheetsFilterUIPlugin,
    UniverSheetsSortPlugin,
    UniverSheetsSortUIPlugin,
    UniverSheetsTablePlugin,
    UniverSheetsTableUIPlugin,
    ...UniverSheetsConditionalFormattingPreset().plugins,
    ...UniverSheetsDataValidationPreset().plugins,
    ...UniverSheetsDrawingPreset({collaboration}).plugins,
    UniverSheetsChartPlugin,
    UniverSheetsChartUIPlugin,
    UniverSheetsPivotTablePlugin,
    UniverSheetsPivotTableUIPlugin,
  ]};
  if(kind==='doc')return{plugins:[
    UniverNetworkPlugin,UniverRenderEnginePlugin,[UniverUIPlugin,workbench],
    [UniverDrawingPlugin,collaboration?{override:[[IImageIoService,null]]}:{}],
    UniverDrawingUIPlugin,UniverFormulaEnginePlugin,UniverDocsPlugin,UniverDocsUIPlugin,
    UniverDocsDrawingPlugin,UniverDocsDrawingUIPlugin,
    UniverDocsChartPlugin,UniverDocsChartUIPlugin,
  ]};
  const common:IPreset['plugins']=[UniverNetworkPlugin,UniverRenderEnginePlugin,[UniverUIPlugin,workbench],UniverDocsPlugin,UniverDocsUIPlugin,[UniverDrawingPlugin,collaboration?{override:[[IImageIoService,null]]}:{}]];
  if(kind==='slide')return{plugins:[...common,UniverSlidesPlugin,UniverSlidesUIPlugin]};
  // Collaboration Client owns attachment IO in live editors; static snapshots
  // keep the Base UI implementation. Registering both prevents Base rendering.
  if(kind==='base')return{plugins:[...common,UniverProFormulaEnginePlugin,UniverBasesPlugin,[UniverBasesUIPlugin,{disableEdit:!editing,workbench:{header:editing,headerMenu:editing},...(collaboration?{override:[[IAttachmentIoService,null]]}:{})}]]};
  return{plugins:[...common,UniverBoardsPlugin,[UniverBoardsUIPlugin,{workbench:{header:editing,headerMenu:editing,toolbar:editing}}]]};
}
