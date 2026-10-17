/** Lossless geometry compression and a mandatory checked-source export gate. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
const [source, reportPath, destination]=process.argv.slice(2);
if(!destination)throw Error('Usage: node tools/pack-house.mjs raw.glb export-report.json output.glb');
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
if(!Array.isArray(report.critical_defects)||report.critical_defects.length)throw Error('Critical geometry gate failed');
const bytes=await fs.readFile(source);
const sha=data=>createHash('sha256').update(data).digest('hex');
if(sha(bytes)!==report.raw_glb_sha256)throw Error('Unchecked or changed input GLB');
const jsonLength=bytes.readUInt32LE(12), doc=JSON.parse(bytes.subarray(20,20+jsonLength)), bin=bytes.subarray(28+jsonLength);
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const chunks=[];let length=0,fallback=0,checked=0;
function append(data){const offset=length,pad=Buffer.alloc(Math.ceil(data.length/4)*4);Buffer.from(data).copy(pad);chunks.push(pad);length+=pad.length;return offset;}
for(let i=0;i<doc.bufferViews.length;i++){
 const v=doc.bufferViews[i], data=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
 if(v.target===34962||v.target===34963){
  const a=doc.accessors.find(a=>a.bufferView===i);
  const sizes={5121:1,5123:2,5125:4,5126:4}, components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const stride=v.byteStride??sizes[a.componentType]*components[a.type],count=data.length/stride,mode=v.target===34963?'INDICES':'ATTRIBUTES';
  const encoded=MeshoptEncoder.encodeGltfBuffer(data,count,stride,mode), decoded=new Uint8Array(data.length);
  MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,encoded,mode,'NONE');
  if(!Buffer.from(decoded).equals(data))throw Error(`Lossless decode check failed at view ${i}`);
  checked++;
  v.buffer=1;v.byteOffset=fallback;fallback=Math.ceil((fallback+v.byteLength)/4)*4;
  v.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:append(encoded),byteLength:encoded.length,byteStride:stride,count,mode,filter:'NONE'}};
 }else{v.buffer=0;v.byteOffset=append(data);}
}
doc.buffers=[{byteLength:length},{byteLength:fallback,extensions:{EXT_meshopt_compression:{fallback:true}}}];
for(const key of ['extensionsUsed','extensionsRequired'])doc[key]=[...new Set([...(doc[key]??[]),'EXT_meshopt_compression'])];
function clean(value){if(!value||typeof value!=='object')return;if(!Array.isArray(value)){delete value.name;delete value.extras;}Object.values(value).forEach(clean);}
for(const [key,value] of Object.entries(doc))if(key!=='materials')clean(value);
for(const material of doc.materials)delete material.extras;
doc.asset={version:'2.0',generator:'DREAM VIEW browser export'};
const json=Buffer.from(JSON.stringify(doc)), padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+padded.length+length,8);head.writeUInt32LE(padded.length,12);head.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([head,padded,bh,...chunks]);await fs.writeFile(destination,result);
await fs.writeFile(destination+'.verification.json',JSON.stringify({sha256:sha(result),raw_sha256:sha(bytes),lossless_buffer_views:checked,position_quantization:false,critical_defects:[]},null,2));
console.log(`Packed ${checked} buffer views; every decoded byte equals the checked input.`);
