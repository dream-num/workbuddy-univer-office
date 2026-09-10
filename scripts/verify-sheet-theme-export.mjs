import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
const {workspace,target}=JSON.parse(await readFile('.data/sheet-data-target.json','utf8'));
const app=await startServer({workspace,port:0});
try{
 const call=async(path,body)=>{const r=await fetch(app.origin+'/api'+path,{method:'POST',headers:{authorization:`Bearer ${app.agentToken}`,'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;};
 const read=()=>call('/content',{target,action:'execute',mode:'read',code:`const s=workbook.getActiveSheet();return {values:s.getRange('A1:H9').getRawValues(),hidden:s.getFilter().getFilteredOutRows(),tables:s.getSubTableInfos().map(table=>({...table,columns:table.columns.map(({id,...column})=>column)}))};`});
 const before=await call('/content',{target,action:'snapshot'}),readBefore=await read();
 const exported=await call('/delivery',{target,action:'export',output:process.argv[2]??'sheet-data-theme-fixed.xlsx'});
 const after=await call('/content',{target,action:'snapshot'});
 assert.equal(after.revision,before.revision);assert.deepEqual(await read(),readBefore);
 assert.deepEqual(after.unitData.sheets.data.rowData,before.unitData.sheets.data.rowData);
 const evidence={exported,revision:after.revision,sourceValuesFiltersTableSemanticsAndRowMetadataUnchanged:true,excludedFromComparison:'SDK regenerates table column IDs when loading this fixture; column identity stability is not verified.'};
 await writeFile('.data/sheet-theme-fixed-export.json',JSON.stringify(evidence,null,2));console.log(evidence);
}finally{await app.close();}
