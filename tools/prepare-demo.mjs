/** Export only reviewed browser runtime assets. Original authoring files stay separate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source=process.argv[2];
if(!source)throw Error('Usage: node tools/prepare-demo.mjs /path/to/verified-runtime-build');
const target=path.resolve('public/browser-demo');
const allowed=['home-preview.webp','viewer-scene.json','models/exterior-home.glb','models/landscape-site.glb','models/landscape-tree.glb','lighting/home-irradiance.webp','lighting/site-irradiance.webp','lighting/blender-agx.png','environments/coastal-sky-512.hdr'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const forbidden=/\/Users\/|\/workspace\/|\.blend["']|\.pdf\b|references\/source|architecture\/revisions|\b(?:password|secret|access_token|api_key)\s*[=:]/i;
function sanitizeGlb(bytes){
 const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 assertNoExternal(json);
 const clean=value=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value)){delete value.extras;delete value.name;}for(const child of Object.values(value))clean(child);};
 // Material names are runtime finish roles, not source-object identity.
 for(const [key,value]of Object.entries(json))if(key!=='materials')clean(value);
 for(const material of json.materials??[])delete material.extras;
 json.asset={version:'2.0',generator:'DREAM VIEW browser export'};
 const encoded=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
 if(forbidden.test(padded.toString()))throw Error('Private model metadata detected');
 const payload=bytes.subarray(20+length),header=Buffer.alloc(20);bytes.subarray(0,20).copy(header);header.writeUInt32LE(20+padded.length+payload.length,8);header.writeUInt32LE(padded.length,12);
 const output=Buffer.concat([header,padded,payload]);
 if(hash(output.subarray(20+padded.length))!==hash(payload))throw Error('GLB binary payload changed');
 return output;
}
function assertNoExternal(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(key==='uri'&&typeof child==='string'&&!child.startsWith('data:'))throw Error('External GLB dependency');assertNoExternal(child);}}
const outputs=[];
for(const file of allowed){let bytes=await fs.readFile(path.resolve(source,file));if(file.endsWith('.glb'))bytes=sanitizeGlb(bytes);if(file==='viewer-scene.json'){const scene=JSON.parse(bytes);scene.architecturePackage='exterior-demo';bytes=Buffer.from(JSON.stringify(scene));if(forbidden.test(bytes.toString()))throw Error('Private scene metadata detected');}outputs.push({file,bytes});}
await fs.mkdir(target,{recursive:true});
for(const entry of await fs.readdir(target))await fs.rm(path.join(target,entry),{recursive:true,force:true});
for(const {file,bytes}of outputs){await fs.mkdir(path.dirname(path.join(target,file)),{recursive:true});await fs.writeFile(path.join(target,file),bytes);}
const manifest={format:1,scope:'Browser runtime only; no authoring sources or references',glbBinaryPayloadPreserved:true,totalBytes:outputs.reduce((n,f)=>n+f.bytes.length,0),files:outputs.map(({file,bytes})=>({file,bytes:bytes.length,sha256:hash(bytes)}))};
await fs.writeFile(path.join(target,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Prepared ${outputs.length} reviewed runtime files (${manifest.totalBytes} bytes). No deployment performed.`);
