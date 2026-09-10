import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,readdir,lstat,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const run=promisify(execFile),destination=resolve('.data/packages');
await mkdir(destination,{recursive:true});
const manifest=JSON.parse(await readFile('package.json','utf8'));
const plugin=JSON.parse(await readFile('.workbuddy-plugin/plugin.json','utf8'));
assert.equal(plugin.name,manifest.name);assert.equal(plugin.version,manifest.version);
assert.match(manifest.name,/^[a-z0-9-]+$/);assert.match(manifest.version,/^[0-9]+\.[0-9]+\.[0-9]+$/);
const files=[];
async function collect(path){
 assert.ok(!path.startsWith('/')&&!path.split('/').includes('..')&&!/[\r\n]/.test(path));
 assert.ok(!path.split('/').some(part=>part.startsWith('._')||part==='.DS_Store'),`macOS metadata is not a package resource: ${path}`);
 assert.ok(!/(^|\/)(\.data|node_modules|\.git|tests|test-host)(\/|$)|\.univer$|\.log$|(^|\/)\.env(?:\.|$)/.test(path),`Private or test file: ${path}`);
 const stat=await lstat(path);assert.ok(!stat.isSymbolicLink(),`Symlink not permitted: ${path}`);
 if(stat.isDirectory()){for(const entry of await readdir(path))await collect(`${path.replace(/\/$/,'')}/${entry}`);}
 else {assert.ok(stat.isFile());files.push(path);}
}
for(const path of new Set(['package.json',...manifest.files]))await collect(path);
files.sort();
assert.deepEqual(files.filter(path=>path.endsWith('/SKILL.md')),['skills/univer-office/SKILL.md'],'The plugin must expose exactly one Skill');
for(const reference of ['sheet','doc','slide','base','board','embed','cross-unit-formula'])assert.ok(files.includes(`skills/univer-office/references/${reference}.md`),`Missing reference: ${reference}`);
for(const required of ['.workbuddy-plugin/plugin.json','skills/univer-office/SKILL.md','assets/univer-office.png','dist/mcp/main.js','dist/mcp/http.js','dist/server/main.js','dist/viewer/index.html','dist/viewer/snapshot.html','dist/render-page/index.html','dist/mcp-app/app.js','dist/mcp-app/index.html','config/registry.npmrc','pnpm-lock.yaml'])assert.ok(files.includes(required),`Missing release entry: ${required}`);
const filename=`${manifest.name}-${manifest.version}.tgz`,archive=resolve(destination,filename),temporary=`${archive}.${randomUUID()}.tmp`;
// BSD tar otherwise adds AppleDouble entries that its own listing can hide.
await run('tar',['-czf',temporary,'--',...files],{env:{...process.env,COPYFILE_DISABLE:'1'},maxBuffer:8*1024*1024});
const archived=(await run('tar',['-tzf',temporary],{maxBuffer:8*1024*1024})).stdout.trim().split('\n').sort();
assert.deepEqual(archived,files,'Archive entries differ from the audited file list');
await rename(temporary,archive);
const bytes=await readFile(archive),integrity=`sha512-${createHash('sha512').update(bytes).digest('base64')}`;
await writeFile(resolve(destination,'package-audit.json'),JSON.stringify({name:manifest.name,version:manifest.version,filename,size:bytes.length,integrity,files},null,2));
console.log(JSON.stringify({archive,files:files.length,bytes:bytes.length}));
