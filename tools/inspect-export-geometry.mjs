/** Decode the delivered geometry for independent dimensional inspection. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';
const [input,output]=process.argv.slice(2);if(!output)throw Error('Pass input.glb output.json');
const bytes=await fs.readFile(input),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.register(parser=>({name:'DIMENSION_INSPECTION',loadMaterial:async i=>{const m=new THREE.MeshStandardMaterial();m.name=parser.json.materials[i].name;return m;}}));
const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');scene.updateMatrixWorld(true);
const surfaces=[];scene.traverse(node=>{
 if(!(node instanceof THREE.Mesh))return;
 const geometry=node.geometry,p=geometry.attributes.position,index=geometry.index.array,points=[];
 for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);points.push([v.x,-v.z,v.y]);}
 surfaces.push({material:node.material.name,points,indices:Array.from(index)});
});
await fs.writeFile(output,JSON.stringify({sha256:createHash('sha256').update(bytes).digest('hex'),surfaces}));
console.log(`Decoded ${surfaces.length} actual runtime primitives.`);
