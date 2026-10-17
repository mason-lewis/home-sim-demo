import {afterEach,expect,test,vi} from 'vitest';
import {loadLocalGlb,validateLocalGlb} from '../viewer/local-model';
function model(json:object,binary=new Uint8Array()){
 const text=new TextEncoder().encode(JSON.stringify(json)),length=Math.ceil(text.length/4)*4,bin=Math.ceil(binary.length/4)*4;
 const bytes=new ArrayBuffer(20+length+(bin?8+bin:0)),header=new DataView(bytes);
 header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,bytes.byteLength,true);header.setUint32(12,length,true);header.setUint32(16,0x4e4f534a,true);
 new Uint8Array(bytes,20,length).fill(32);new Uint8Array(bytes,20,text.length).set(text);
 if(bin){header.setUint32(20+length,bin,true);header.setUint32(24+length,0x004e4942,true);new Uint8Array(bytes,28+length,binary.length).set(binary);}return bytes;
}
afterEach(()=>vi.unstubAllGlobals());
test('private imports reject external buffers and images before any network access',async()=>{
 const fetch=vi.fn(()=>{throw Error('Unexpected network access');});vi.stubGlobal('fetch',fetch);
 await expect(loadLocalGlb(model({asset:{version:'2.0'},buffers:[{uri:'https://example.invalid/geometry.bin',byteLength:36}]}))).rejects.toThrow('external files');
 await expect(loadLocalGlb(model({asset:{version:'2.0'},images:[{uri:'../private-image.png'}]}))).rejects.toThrow('external files');
 expect(fetch).not.toHaveBeenCalled();
});
test('a self-contained model loads locally and malformed files are rejected',async()=>{
 const fetch=vi.fn(()=>{throw Error('Unexpected network access');});vi.stubGlobal('fetch',fetch);
 expect(()=>validateLocalGlb(new ArrayBuffer(40))).toThrow('valid GLB');
 const points=new Float32Array([0,0,0,1,0,0,0,1,0]);
 const loaded=await loadLocalGlb(model({asset:{version:'2.0'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0},new Uint8Array(points.buffer)));
 let vertices=0;loaded.scene.traverse(node=>{if('geometry' in node)vertices+=(node.geometry as {attributes:{position:{count:number}}}).attributes.position.count;});expect(vertices).toBe(3);expect(fetch).not.toHaveBeenCalled();
});
