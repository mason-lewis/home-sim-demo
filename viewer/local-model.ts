import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';

/** Reject external dependencies before invoking any loader. The URL modifier
 * also blocks resources requested by supported extensions. No upload path exists. */
export function validateLocalGlb(bytes:ArrayBuffer){
 if(bytes.byteLength<20||bytes.byteLength>100*1024*1024)throw Error('Choose a self-contained GLB smaller than 100 MB.');
 const header=new DataView(bytes);
 if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength||header.getUint32(16,true)!==0x4e4f534a||header.getUint32(12,true)>bytes.byteLength-20)throw Error('This file is not a valid GLB model.');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,header.getUint32(12,true))));
 for(const asset of [...json.buffers??[],...json.images??[]])if(asset.uri&&!asset.uri.startsWith('data:'))throw Error('This GLB uses external files. Please export a self-contained GLB.');
 return json;
}
export async function loadLocalGlb(bytes:ArrayBuffer){
 validateLocalGlb(bytes);
 const manager=new THREE.LoadingManager();
 manager.setURLModifier(url=>{if(!url.startsWith('data:')&&!url.startsWith('blob:'))throw Error('This GLB uses external files. Please export a self-contained GLB.');return url;});
 return new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes,'');
}
