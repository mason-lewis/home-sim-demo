/** Compress/sanitize the temporary tree export, preserving texture alpha and geometry UVs. */
import fs from 'node:fs/promises';
import {MeshoptEncoder} from 'meshoptimizer';
const source=process.argv[2];
if(!source)throw Error('Pass the temporary tree GLB to pack.');
const bytes=await fs.readFile(source),jsonLength=bytes.readUInt32LE(12);
const document=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);
// Blender emits constant white vertex colors that have no visual contribution.
for(const mesh of document.meshes)for(const primitive of mesh.primitives)for(const key of Object.keys(primitive.attributes))if(key.startsWith('COLOR_'))delete primitive.attributes[key];
const usedAccessors=new Set(document.meshes.flatMap(mesh=>mesh.primitives.flatMap(p=>[p.indices,...Object.values(p.attributes)])));
const accessorMap=new Map();document.accessors=document.accessors.filter((accessor,index)=>{if(!usedAccessors.has(index))return false;accessorMap.set(index,accessorMap.size);return true;});
for(const mesh of document.meshes)for(const primitive of mesh.primitives){primitive.indices=accessorMap.get(primitive.indices);for(const key of Object.keys(primitive.attributes))primitive.attributes[key]=accessorMap.get(primitive.attributes[key]);}
const usedViews=new Set([...document.accessors.map(a=>a.bufferView),...document.images.map(image=>image.bufferView)]),viewMap=new Map();
document.bufferViews=document.bufferViews.filter((view,index)=>{if(!usedViews.has(index))return false;viewMap.set(index,viewMap.size);return true;});
for(const accessor of document.accessors)accessor.bufferView=viewMap.get(accessor.bufferView);
for(const image of document.images)image.bufferView=viewMap.get(image.bufferView);
const semantics=new Map(document.meshes.flatMap(m=>m.primitives.flatMap(p=>Object.entries(p.attributes).map(([name,index])=>[index,name]))));
await MeshoptEncoder.ready;
const chunks=[];let length=0,fallbackLength=0;
function append(data){const offset=length,padded=Buffer.alloc(Math.ceil(data.length/4)*4);Buffer.from(data).copy(padded);chunks.push(padded);length+=padded.length;return offset;}
for(let i=0;i<document.bufferViews.length;i++){
 const view=document.bufferViews[i],data=Buffer.from(binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
 if(view.target===34962||view.target===34963){
  const accessor=document.accessors.find(a=>a.bufferView===i),stride=view.byteStride??(view.target===34963?(accessor.componentType===5123?2:4):({VEC2:2,VEC3:3,VEC4:4,SCALAR:1}[accessor.type]*4));
  // Sub-millimeter positions, fine normals, and sub-pixel UVs retain visible
  // detail while discarding float mantissa noise before entropy compression.
  if(view.target===34962&&accessor.componentType===5126){
   const semantic=semantics.get(document.accessors.indexOf(accessor));
   const precision=semantic.startsWith('TEXCOORD')?8192:2048;
   for(let at=0;at<data.length;at+=4)data.writeFloatLE(Math.round(data.readFloatLE(at)*precision)/precision,at);
   if(accessor.min)accessor.min=accessor.min.map(n=>Math.floor(n*precision)/precision);
   if(accessor.max)accessor.max=accessor.max.map(n=>Math.ceil(n*precision)/precision);
  }
  const count=data.length/stride,mode=view.target===34963?'TRIANGLES':'ATTRIBUTES';
  const encoded=MeshoptEncoder.encodeGltfBuffer(data,count,stride,mode);
  const offset=append(encoded);
  view.buffer=1;view.byteOffset=fallbackLength;fallbackLength+=view.byteLength;
  fallbackLength=Math.ceil(fallbackLength/4)*4;
  view.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:encoded.length,byteStride:stride,count,mode,filter:'NONE'}};
 }else{view.buffer=0;view.byteOffset=append(data);}
}
document.buffers=[{byteLength:length},{byteLength:fallbackLength,extensions:{EXT_meshopt_compression:{fallback:true}}}];
document.extensionsUsed=[...new Set([...(document.extensionsUsed??[]),'EXT_meshopt_compression'])];
document.extensionsRequired=[...new Set([...(document.extensionsRequired??[]),'EXT_meshopt_compression'])];
const clean=value=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value)){delete value.name;delete value.extras;}for(const child of Object.values(value))clean(child);};
for(const [key,value]of Object.entries(document))if(key!=='materials')clean(value);
for(const material of document.materials){delete material.extras;if(material.name==='tree-leaf'){material.alphaMode='MASK';material.alphaCutoff=.42;}}
document.asset={version:'2.0',generator:'DREAM VIEW browser export'};
const json=Buffer.from(JSON.stringify(document)),paddedJson=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(paddedJson);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+paddedJson.length+length,8);header.writeUInt32LE(paddedJson.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binaryHeader=Buffer.alloc(8);binaryHeader.writeUInt32LE(length,0);binaryHeader.writeUInt32LE(0x004e4942,4);
await fs.writeFile('public/browser-demo/models/landscape-tree.glb',Buffer.concat([header,paddedJson,binaryHeader,...chunks]));
console.log(`Packed detailed tree: ${length} binary bytes.`);
