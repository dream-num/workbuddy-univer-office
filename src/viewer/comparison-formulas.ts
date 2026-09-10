import {CellValueType, Inject, Injector, InterceptorEffectEnum, Plugin, UniverInstanceType} from '@univerjs/core';
import {FormulaDataModel} from '@univerjs-pro/engine-formula';
import {INTERCEPTOR_POINT, SheetInterceptorService} from '@univerjs/sheets';

/** Installed only in a disposable read-only comparison iframe. No formula/value mutations. */
export class ComparisonFormulaPlugin extends Plugin {
  static override pluginName = 'WORKBUDDY_COMPARISON_FORMULAS';
  static override type = UniverInstanceType.UNIVER_SHEET;
  constructor(_config: unknown, protected override readonly _injector: Injector) {super();}
  override onReady() {
    const formulas = this._injector.get(FormulaDataModel);
    this.disposeWithMe(this._injector.get(SheetInterceptorService).intercept(INTERCEPTOR_POINT.CELL_CONTENT, {
      effect: InterceptorEffectEnum.Value,
      priority: 0,
      handler: (cell, position, next) => {
        const formula = formulas.getFormulaStringByCell(position.row, position.col, position.subUnitId, position.unitId);
        return next(cell && formula ? {...cell, v: formula, t: CellValueType.STRING, p: null} : cell);
      },
    }));
  }
}
Inject(Injector)(ComparisonFormulaPlugin, undefined, 1);
