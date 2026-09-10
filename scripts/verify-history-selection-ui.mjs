import {copyFile,mkdir,readFile,writeFile,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../dist/server/main.js';
const workspace=resolve('.data/history-selection-workspace');
await mkdir(workspace,{recursive:true});
await copyFile('.data/sheet-restore-ui-workspace/sheet-restore-ui.univer',resolve(workspace,'multiple-versions.univer'),constants.COPYFILE_EXCL);
const evidence=JSON.parse(await readFile('.data/sheet-restore-ui-evidence.json','utf8'));
const app=await startServer({workspace,port:9082});
try{
 const file=await app.office.open('single-version.univer',true),fileId=file.catalog.fileId;
 const draft=await app.office.createWorktree(fileId),unit=await app.office.createUnit(fileId,draft.worktreeID,'sheet','仅有当前版本');
 await app.office.action(fileId,draft.worktreeID,'ready','agent');
 const review=await app.office.reviewState(fileId,draft.worktreeID);
 await app.office.action(fileId,draft.worktreeID,'merge','viewer',review.fingerprint);
 const url=new URL(app.launchUrl);url.searchParams.set('file',evidence.fileId);url.searchParams.set('unit',evidence.unitId);
 await writeFile('.data/history-selection-runtime.json',JSON.stringify({launchUrl:url.href,singleFileId:fileId,singleUnitId:unit.unitId}),{mode:0o600});
 console.log(JSON.stringify({pid:process.pid}));
}catch(e){await app.close();throw e;}
process.once('SIGTERM',async()=>{await app.close();process.exit(0);});
