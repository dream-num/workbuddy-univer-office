import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveOfficeLocale,localeText} from '../../dist/shared/locale.js';

test('host BCP47 and SDK locale values map to supported languages without replacing a valid preference on invalid input',()=>{
 for(const value of ['en','en-US','en_GB','enUS','en-IN'])assert.equal(resolveOfficeLocale(value),'en-US');
 for(const value of ['zh','zh-CN','zhCN','zh-Hans-CN','zh-Hant-TW'])assert.equal(resolveOfficeLocale(value,'en-US'),'zh-CN');
 for(const value of [undefined,null,{},'not a language','fr-FR',''])assert.equal(resolveOfficeLocale(value,'en-US'),'en-US');
 assert.equal(resolveOfficeLocale(undefined),'zh-CN');
});

test('card controls and preview states translate while names outside the UI dictionary remain untouched',()=>{
 assert.equal(localeText('en-US','刷新预览'),'Refresh preview');
 assert.equal(localeText('en-US','修改中 · 只读'),'Draft · Read-only');
 assert.equal(localeText('en-US','● 已同步'),'● Synced');
 assert.equal(localeText('zh-CN','刷新预览'),'刷新预览');
 assert.equal(localeText('en-US','客户资料 2026'),'客户资料 2026');
});
