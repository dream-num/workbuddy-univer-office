import {LocaleType} from '@univerjs/core';
import type {FUniver} from '@univerjs/core/facade';
import type {OfficeLocale} from '../shared/locale.js';

const requests=new WeakMap<FUniver,OfficeLocale>();
export function cancelEditorLocale(api:FUniver){requests.delete(api);}
/** Use public locale APIs to preserve the current Unit, viewport and selection. */
export async function applyEditorLocale(api:FUniver,locale:OfficeLocale){
 requests.set(api,locale);
 if(locale==='en-US'){
  const {englishLocales}=await import('./locales-en.js');
  if(requests.get(api)!==locale)return;
  api.loadLocales(LocaleType.EN_US,englishLocales);
 }
 if(requests.get(api)===locale)api.setLocale(locale==='en-US'?LocaleType.EN_US:LocaleType.ZH_CN);
}
