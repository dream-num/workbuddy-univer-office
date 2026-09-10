import {CellValueType, extractPureTextFromCell, type IWorkbookData, type ICellData} from '@univerjs/core';
import type {IUnitComparisonItem, IUnitComparisonScopeReference} from '@univerjs-pro/edit-history';
import {comparisonChangeLines} from './comparison-description.js';

export type SheetCompareMode = 'content' | 'formatting';
export function scopeKey(scope?: IUnitComparisonScopeReference) {
  return scope ? JSON.stringify([scope.entityType, scope.stableId]) : '';
}

/** Project SDK changes, never compute another diff from the snapshots. */
export function visibleComparisonItems(items: readonly IUnitComparisonItem[], options: {
  sheetMode?: SheetCompareMode; scope?: string; search?: string;
}): IUnitComparisonItem[] {
  const query = options.search?.trim().toLocaleLowerCase();
  return items.flatMap(item => {
    if (options.scope && scopeKey(item.scope) !== options.scope) return [];
    let visible = item;
    if (options.sheetMode && item.entityType === 'cell' && item.kind === 'update') {
      const changes = item.changes.filter(change => (change.path[0] === 'style') === (options.sheetMode === 'formatting'));
      if (!changes.length) return [];
      visible = {...item, changes};
    }
    // Insertions/deletions and structural changes remain visible in either mode.
    if (query && ![visible.displayName, visible.stableId, visible.entityType,...comparisonChangeLines(visible),
      ...visible.changes.flatMap(change => [change.path.join('.'), scalar(change.before), scalar(change.after)])]
      .some(value => value?.toLocaleLowerCase().includes(query))) return [];
    return [visible];
  });
}
function scalar(value: unknown): string {return value != null && typeof value !== 'object' ? String(value) : '';}

// Office SDK snapshot resource identifiers. Table identity and all nonvisual resources survive.
const rangeThemes = 'SHEET_RANGE_THEME_MODEL_PLUGIN';
const tableResource = 'SHEET_TABLE_PLUGIN';
const plainTheme = 'workbuddy-compare-plain';
export function sheetComparisonSnapshot(source: IWorkbookData, mode: SheetCompareMode): IWorkbookData {
  const copy = structuredClone(source);
  if (mode === 'formatting') return copy;
  copy.styles = {};
  delete copy.defaultStyle;
  for (const sheet of Object.values(copy.sheets)) {
    delete sheet.defaultStyle;
    for (const axis of [sheet.rowData, sheet.columnData]) {
      for (const entry of Object.values(axis ?? {})) if (entry) delete entry.s;
    }
    for (const cells of Object.values(sheet.cellData ?? {})) {
      for (const cell of Object.values(cells ?? {}) as Array<ICellData | null>) {
        if (!cell) continue;
        delete cell.s;
        if (cell.p) {
          cell.v = extractPureTextFromCell(cell).replaceAll('\r', '\n');
          cell.t = CellValueType.STRING;
          delete cell.p;
        }
      }
    }
  }
  let tables = false;
  copy.resources = copy.resources?.filter(resource => ![rangeThemes, 'SHEET_CONDITIONAL_FORMATTING_PLUGIN'].includes(resource.name))
    .map(resource => {
      if (resource.name !== tableResource) return resource;
      const data = JSON.parse(resource.data);
      for (const entry of Object.values(data) as Array<{tables?: Array<{options?: Record<string, unknown>}>} | Array<{options?: Record<string, unknown>}>>) {
        for (const table of (Array.isArray(entry) ? entry : entry.tables) ?? []) {
          table.options = {...table.options, tableStyleId: plainTheme};
          tables = true;
        }
      }
      return {...resource, data: JSON.stringify(data)};
    });
  if (tables) copy.resources!.push({name: rangeThemes, data: JSON.stringify({
    rangeThemeStyleRuleMap: {}, rangeThemeStyleMapJson: {[plainTheme]: {name: plainTheme}},
  })});
  return copy;
}
