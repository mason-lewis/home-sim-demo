/** Bake neutral contact occlusion from the reviewed runtime geometry only.
 * Usage: node tools/bake-occlusion.mjs /path/to/Blender
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
const blender=process.argv[2];
if(!blender)throw Error('Pass the Blender executable as the first argument.');
const runtimeRoot=process.argv[3]??'public/browser-demo';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'dream-view-occlusion-'));
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// AO uses geometry alone. Do not decode or copy source color textures.
loader.register(parser=>({name:'OCCLUSION_GEOMETRY',loadMaterial:async index=>{
 const material=new THREE.MeshStandardMaterial();material.name=parser.json.materials[index].name;return material;
}}));
const objects=[];
for(const [name,atlas]of [['exterior-home','home'],['landscape-site','site']]){
 const bytes=await fs.readFile(`${runtimeRoot}/models/${name}.glb`);
 const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 scene.updateMatrixWorld(true);
 scene.traverse(node=>{
  if(!(node instanceof THREE.Mesh)||!node.geometry.attributes.uv1)return;
  const geometry=node.geometry,p=geometry.attributes.position,uv=geometry.attributes.uv1,positions=[],uvs=[];
  for(let i=0;i<p.count;i++){positions.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld).toArray());uvs.push([uv.getX(i),1-uv.getY(i)]);}
  objects.push({atlas,positions,uvs,indices:Array.from(geometry.index.array)});
 });
}
const input=path.join(temporary,'geometry.json');
await fs.writeFile(input,JSON.stringify(objects));
await new Promise((resolve,reject)=>{
 const child=spawn(blender,['--background','--factory-startup','--python',path.resolve('tools/bake-occlusion.py'),'--',input,temporary,...(process.argv.includes('--home-only')?['--home-only']:[])],{stdio:'inherit'});
 child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Blender exited ${code}`)));
});
for(const atlas of (process.argv.includes('--home-only')?['home']:['home','site'])){
 await sharp(path.join(temporary,`${atlas}-ao.png`)).removeAlpha().webp({lossless:true}).toFile(`${runtimeRoot}/lighting/${atlas}-ao.webp`);
}
await fs.rm(temporary,{recursive:true,force:true});
console.log('Baked neutral ambient occlusion. No daylight or sun shadows in the atlases.');
