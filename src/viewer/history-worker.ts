import {LocaleType} from '@univerjs/core';
import {createUniver} from '@univerjs/presets';
import {UniverSheetsCoreWorkerPreset} from '@univerjs/preset-sheets-core/worker';
import SheetsZh from '@univerjs/preset-sheets-core/locales/zh-CN';

createUniver({locale:LocaleType.ZH_CN,locales:{[LocaleType.ZH_CN]:SheetsZh},presets:[UniverSheetsCoreWorkerPreset()]});
