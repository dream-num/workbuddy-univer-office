import {copyFile,mkdir,readFile,writeFile,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../dist/server/main.js';
import {protocolTypes} from '../dist/application/office.js';
const phase=process.argv[2];assert.ok(['create','verify'].includes(phase));
const workspace=resolve('.data/unit-restore-ui-workspace'),source=JSON.parse(await readFile('.data/unit-removal-ui-evidence.json','utf8'));
if(phase==='create'){await mkdir(workspace,{recursive:true});await copyFile('.data/unit-removal-ui-workspace/reviewed-removal.univer',resolve(workspace,'recover-retained-content.univer'),constants.COPYFILE_EXCL);}
const app=await startServer({workspace,port:9082});
try{
 const file=app.office.file(source.fileId);
 if(phase==='create'){
  assert.equal(file.catalog.get('unit',source.unitId).removed,true);
  const url=new URL(app.launchUrl);
  await writeFile('.data/unit-restore-ui-runtime.json',JSON.stringify({launchUrl:url.href}),{mode:0o600});console.log(JSON.stringify({pid:process.pid}));
 }else{
  await app.office.resolveTarget({fileId:source.fileId,unitId:source.unitId,branch:'trunk'});
  const load=await file.service.getUnitLoadData({unitID:source.unitId,type:protocolTypes.sheet,revision:0},{userID:'application'});
  assert.deepEqual(JSON.parse(JSON.stringify(load)),source.baseline);
  assert.equal((await app.office.removedUnits(source.fileId)).length,0);
  const receipt=file.catalog.get('directory-restore',source.unitId);assert.equal(receipt.actor,'viewer');assert.ok(receipt.removalIds.includes(source.worktreeId));
  await writeFile('.data/unit-restore-ui-evidence.json',JSON.stringify({unitId:source.unitId,revision:load.targetRevision,receipt},null,2));
  console.log('UI directory recovery verified after restart: visible before status, original content/revision unchanged, viewer receipt retained.');await app.close();process.exit(0);
 }
}catch(error){await app.close();throw error;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
