import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,copyFile,chmod,mkdtemp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';

const run=promisify(execFile),root=process.cwd(),output=resolve('.data/connector-runtime');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile('package.json','utf8'));
// npm's dry run enumerates only package.json's explicit public file allowlist.
const listing=JSON.parse((await run('npm',['pack','--dry-run','--ignore-scripts','--json'],{maxBuffer:4*1024*1024})).stdout)[0];
const stage=await mkdtemp(resolve('.data/connector-runtime-stage-'));
for(const {path} of listing.files){
 assert.ok(!path.startsWith('/')&&!path.split('/').includes('..'));
 assert.ok(!/(^|\/)(node_modules|\.data|\.git|\.env|\._[^/]*)(\/|$)/.test(path));
 if(path==='package.json'||path==='config/runtime-npm-shrinkwrap.json')continue;
 const destination=resolve(stage,path);await mkdir(dirname(destination),{recursive:true});await copyFile(resolve(root,path),destination);
}
delete manifest.devDependencies;delete manifest.private;
manifest.files.push('npm-shrinkwrap.json');
await writeFile(resolve(stage,'package.json'),JSON.stringify(manifest,null,2)+'\n');
const lockText=await readFile('config/runtime-npm-shrinkwrap.json','utf8');
const lock=JSON.parse(lockText);
assert.equal(lock.name,manifest.name);assert.equal(lock.version,manifest.version);
assert.deepEqual(lock.packages[''].dependencies,manifest.dependencies);
assert.ok(!/\/Users\/|file:|"link":\s*true/.test(lockText),'Runtime lock must not depend on local packages');
await writeFile(resolve(stage,'npm-shrinkwrap.json'),lockText);
await chmod(resolve(stage,'bin/univer-office.mjs'),0o755);
const packed=JSON.parse((await run('npm',['pack','--ignore-scripts','--json','--pack-destination',output],{cwd:stage,maxBuffer:4*1024*1024})).stdout)[0];
assert.equal(packed.files.filter(file=>file.path.endsWith('/SKILL.md')).length,1);
assert.ok(packed.files.some(file=>file.path==='npm-shrinkwrap.json'));
await writeFile(resolve(output,'runtime-audit.json'),JSON.stringify(packed,null,2)+'\n');
console.log(JSON.stringify({archive:resolve(output,packed.filename),bytes:packed.size,integrity:packed.integrity,entries:packed.entryCount}));
