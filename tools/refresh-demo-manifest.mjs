import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runtimeAssets} from './runtime-assets.mjs';
const files=[];
for(const file of runtimeAssets){
 const bytes=await fs.readFile('public/browser-demo/'+file);
 files.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const manifest={format:1,scope:'Browser runtime only; no authoring sources or references',totalBytes:files.reduce((n,f)=>n+f.bytes,0),files};
await fs.writeFile('public/browser-demo/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Recorded ${files.length} runtime files (${manifest.totalBytes} bytes).`);
