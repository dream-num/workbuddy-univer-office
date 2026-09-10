import {SheetRangeThemeModel,type IRangeThemeStyleJSON} from '@univerjs/sheets';
import {FWorkbook} from '@univerjs/sheets/facade';

// Read-only application extension. Resolve defaults from the same SDK graph as
// the workbook instead of copying palettes or changing its registered themes.
class FWorkbookOfficeExport extends FWorkbook {
  getOfficeExportThemes(names:string[]):Record<string,IRangeThemeStyleJSON>{
    const model=this._injector.get(SheetRangeThemeModel);
    const themes:Record<string,IRangeThemeStyleJSON>={};
    for(const name of names){
      const theme=model.getRangeThemeStyle(this.getId(),name);
      if(!theme)throw new Error(`Export theme unavailable: ${name}`);
      themes[name]=theme.toJson();
    }
    return themes;
  }
}
FWorkbook.extend(FWorkbookOfficeExport);
declare module '@univerjs/sheets/facade'{
  interface FWorkbook{
    getOfficeExportThemes(names:string[]):Record<string,IRangeThemeStyleJSON>;
  }
}
