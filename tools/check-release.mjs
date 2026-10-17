import fs from 'node:fs/promises';
import {runtimeAssets} from './runtime-assets.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await fs.readFile('public/browser-demo/release-manifest.json','utf8'));
const expectedRuntime=runtimeAssets;
assert.deepEqual(manifest.files.map(f=>f.file).sort(),[...expectedRuntime].sort(),'Runtime allowlist changed');
const allowed=new Set([...expectedRuntime,'release-manifest.json']);
const allowedBuild=new Set(['index.html','browser-demo/index.html','favicon.svg',...Array.from(allowed,f=>'browser-demo/'+f),'images/nature-mask.webp',...['morning','day','dusk','night'].flatMap(time=>['images/residence-'+time+'.webp','images/residence-'+time+'-mobile.webp']),...['dm-sans','lucide','manrope','exterior-assets','three','meshoptimizer'].map(name=>'licenses/'+name+'.txt')]);
const generated=/^assets\/(?:(?:site|studio|brand|graphics|exercise|modulepreload-polyfill)-[A-Za-z0-9_-]{8}\.js|(?:site|studio|brand)-[A-Za-z0-9_-]{8}\.css|(?:dm-sans|manrope)-[A-Za-z0-9_-]+\.woff2?)$/;

const forbidden=/\/Users\/|\/workspace\/|\.blend["']|references\/source|architecture\/revisions|source_sha256|streams\.vagon\.io/i;
async function walk(dir){const files=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
for(const file of await walk('public/browser-demo'))assert(allowed.has(path.relative('public/browser-demo',file)),`Unexpected model asset ${file}`);
for(const entry of manifest.files){const bytes=await fs.readFile(path.join('public/browser-demo',entry.file));assert.equal(hash(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);
 if(entry.file.endsWith('.glb')){const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert(!forbidden.test(JSON.stringify(json)));assert(!json.cameras&&!json.animations);assert(!JSON.stringify(json).includes('extras'));assert(json.meshes?.length);}
 if(entry.file.endsWith('.json'))assert(!forbidden.test(bytes.toString()));
}
for(const file of await walk('dist')){const name=path.relative('dist',file);assert(allowedBuild.has(name)||generated.test(name),`Unexpected build file: ${name}`);assert(!/\.(blend|pdf|hdr\.txt|map|log|md|zip)$/i.test(name),`Private or source artifact in build: ${name}`);if(/\.(html|js|css|json)$/i.test(name))assert(!forbidden.test(await fs.readFile(file,'utf8')),`Private text or remote renderer in ${name}`);}
const entry=await fs.readFile('dist/browser-demo/index.html','utf8');assert(entry.includes('../assets/'));assert(!entry.includes('vagon'));
console.log(JSON.stringify({passed:true,runtimeFiles:manifest.files.length,modelAssetBytes:manifest.totalBytes,metadataSanitized:true,noRemoteRenderer:true,noAuthoringReferencesOrCredentials:true},null,2));
