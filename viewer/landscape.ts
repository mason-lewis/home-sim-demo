import * as THREE from 'three';
import {applyOcclusion} from './lighting';
import {extractTriangles, triangleCenter} from './geometry';
export interface ViewerSite {
  architecturePackage: string;
  trees: {id:number;position:number[];scale:number[];yaw:number;tone:number}[];
  grassTriangles: number[][][];
  grassExclusions?:number[][][]; grassEdgeClearance?:number;
  homeOcclusion: string; siteOcclusion: string;
  sun: { direction: number[]; energy:number; angularDiameter:number };
  environmentEnergy:number; environmentRotation:number; ground:number;
}
const up = new THREE.Vector3(0,1,0);
function randomGenerator(seed:number) { return () => { seed = (Math.imul(seed,1664525)+1013904223)|0; return (seed>>>0)/4294967296; }; }

/** Short, curved lawn blades over a full-scale photographic turf underlay. */
function bladePrototype(bladeCount:number) {
  const positions:number[] = [], colors:number[] = [], indices:number[]=[];
  for (let blade=0;blade<bladeCount;blade++) {
    const yaw=blade*2.39996, height=.027+blade*.003, width=.0028;
    const side=new THREE.Vector3(Math.cos(yaw)*width,0,Math.sin(yaw)*width);
    const lean=new THREE.Vector3(-Math.sin(yaw)*.009,height,Math.cos(yaw)*.009);
    const mid=lean.clone().multiplyScalar(.55); mid.y=height*.62;
    const vs=[side.clone().negate(),side,mid.clone().addScaledVector(side,-.65),mid.clone().addScaledVector(side,.65),lean];
    const offset=positions.length/3;
    for(let i=0;i<vs.length;i++) {
      positions.push(...vs[i].toArray());
      const c=new THREE.Color().setRGB(.115,.19,.055).multiplyScalar(i<2?.85:i===4?1.1:1);
      colors.push(c.r,c.g,c.b);
    }
    indices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2,offset+2,offset+3,offset+4);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
export function addLandscape(scene:THREE.Scene, site:THREE.Group, tree:THREE.Group, config:ViewerSite, occlusion:THREE.Texture) {
  const materials=new Set<THREE.Material>();
  const surfaces:THREE.Mesh[]=[];
  site.updateMatrixWorld(true);
  site.traverse(node=>{if(node instanceof THREE.Mesh)surfaces.push(node);});
  const turf=surfaces.find(node=>(node.material as THREE.Material).name==='site-turf')!.material as THREE.MeshStandardMaterial;
  const restoredTriangles:number[][][]=[];
  // Preserve this home's driveway. The driveway/gravel beyond the far road
  // shoulder becomes lawn, using the same terrain vertices and grass density.
  const farRoadEdge=(x:number)=>29.01864-(x+8)*.01717;
  let removedDrivewayTriangles=0;
  for(const mesh of surfaces){
    const name=(mesh.material as THREE.Material).name;
    if(!['site-driveway','site-joints','site-gravel'].includes(name))continue;
    const offsets:number[]=[];
    for(let offset=0;offset<mesh.geometry.index!.count;offset+=3){
      const center=triangleCenter(mesh,offset);
      if(center.z>farRoadEdge(center.x)+.08)offsets.push(offset);
    }
    const lawn=extractTriangles(mesh,offsets,turf);
    if(!lawn)continue;
    removedDrivewayTriangles+=offsets.length;
    lawn.name='restored-lawn-across-street';lawn.updateMatrixWorld(true);
    const geometry=lawn.geometry,positions=geometry.attributes.position,uvs:number[]=[];
    for(let i=0;i<positions.count;i++)uvs.push(positions.getX(i)*.5,positions.getZ(i)*.5);
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    for(let offset=0;offset<geometry.index!.count;offset+=3){
      const triangle=[];
      for(let j=0;j<3;j++)triangle.push(new THREE.Vector3().fromBufferAttribute(positions,geometry.index!.getX(offset+j)).applyMatrix4(lawn.matrixWorld).toArray());
      restoredTriangles.push(triangle);
    }
  }
  site.traverse(node => {
    if (!(node instanceof THREE.Mesh))return;
    const ms=Array.isArray(node.material)?node.material:[node.material];
    for(const material of ms)if(material instanceof THREE.MeshStandardMaterial){
      material.side=THREE.FrontSide;
      applyOcclusion(material,occlusion);
      if(material.name==='site-turf'){
        material.color.set('#b4c6a4');material.roughness=.95;material.roughnessMap=null;material.normalScale.set(.5,.5);
        material.onBeforeCompile=shader=>{
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 lawnPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nlawnPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 lawnPosition;').replace('#include <map_fragment>','#include <map_fragment>\nfloat mowing=sin(lawnPosition.z*1.7453);float variation=sin(lawnPosition.x*.73+lawnPosition.z*.41)*sin(lawnPosition.z*.53-lawnPosition.x*.31);diffuseColor.rgb*=1.0+.035*mowing+.045*variation;');
        };
        material.customProgramCacheKey=()=> 'photographic-mown-turf-v1';
      }
      for(const tex of [material.map,material.normalMap,material.roughnessMap])if(tex)tex.anisotropy=8;
      materials.add(material);
    }
    node.receiveShadow=true;node.castShadow=false;
  });
  scene.add(site);
  tree.traverse(node => {
    if (!(node instanceof THREE.Mesh))return;
    node.castShadow=true;node.receiveShadow=true;
    for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof THREE.MeshStandardMaterial){
      if(material.name==='tree-leaf') {
        // Respect the authored leaf cutout. A near-zero threshold made entire
        // foliage cards opaque and gave the canopy a grey, blocky silhouette.
        material.transparent=false;material.alphaTest=.42;material.alphaToCoverage=false;material.side=THREE.DoubleSide;
        material.roughness=.85;material.roughnessMap=null;material.metalness=0;material.normalScale.set(.35,.35);
        material.color.set('#d1d8c2');material.envMapIntensity=.3;
        material.emissiveMap=null;material.emissive.setRGB(0,0,0);
        material.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;', 'vec3 irradiance = (dotNL + 0.22 * max(dot(-geometryNormal, directLight.direction), 0.0)) * directLight.color;'));
        };
        material.customProgramCacheKey=()=> 'thin-leaf-translucency-v1';
      }
      for(const tex of [material.map,material.normalMap,material.roughnessMap])if(tex)tex.anisotropy=8;
    }
  });
  const obstacles: THREE.Sphere[] = [];
  for(const placement of config.trees){
    const plant=tree.clone(true);plant.name='retained-tree-'+placement.id;
    // Match the derived Blender scene's interpreted tree orientation exactly.
    plant.position.fromArray(placement.position);plant.scale.fromArray(placement.scale);plant.rotation.y=-placement.yaw;
    plant.traverse(node=>{if(node instanceof THREE.Mesh){node.material=(Array.isArray(node.material)?node.material:[node.material]).map(source=>{const material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;if(material instanceof THREE.MeshStandardMaterial){material.color.multiplyScalar(placement.tone);}return material;})[0];}});
    scene.add(plant);plant.updateMatrixWorld(true);
    obstacles.push(new THREE.Box3().setFromObject(plant).getBoundingSphere(new THREE.Sphere()));
  }
  const rng=randomGenerator(261016), grass=new THREE.Group();grass.name='individual-lawn-blades';
  const triangles=[...config.grassTriangles,...restoredTriangles].map(v=>v.map(p=>new THREE.Vector3().fromArray(p)));
  const areas=triangles.map(([a,b,c])=>new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).length()*.5);
  const area=areas.reduce((a,b)=>a+b,0),count=Math.min(matchMedia('(max-width:760px)').matches?65000:150000,Math.ceil(area*130));
  const cumulative:number[]=[];areas.reduce((sum,a)=>{cumulative.push(sum+a);return sum+a;},0);
  const clearance=config.grassEdgeClearance??.1;
  const exclusions=(config.grassExclusions??[]).map(poly=>({poly,minX:Math.min(...poly.map(p=>p[0]))-clearance,maxX:Math.max(...poly.map(p=>p[0]))+clearance,minZ:Math.min(...poly.map(p=>p[2]))-clearance,maxZ:Math.max(...poly.map(p=>p[2]))+clearance}));
  const crossesPaving=(point:THREE.Vector3)=>exclusions.some(({poly,minX,maxX,minZ,maxZ})=>{
    if(point.z>farRoadEdge(point.x)+.18)return false;
    if(point.x<minX||point.x>maxX||point.z<minZ||point.z>maxZ)return false;
    let positive=false,negative=false;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[2]-a[2],length=dx*dx+dz*dz;
      const t=length?THREE.MathUtils.clamp(((point.x-a[0])*dx+(point.z-a[2])*dz)/length,0,1):0;
      if(Math.hypot(point.x-a[0]-t*dx,point.z-a[2]-t*dz)<clearance)return true;
      const cross=dx*(point.z-a[2])-dz*(point.x-a[0]);positive ||=cross>1e-8;negative ||=cross< -1e-8;
    }
    return !(positive&&negative);
  });
  const cells=new Map<string,THREE.Vector3[]>();let accepted=0;
  for(let i=0;i<count;i++) {
    const pick=rng()*area;let low=0,high=cumulative.length-1;
    while(low<high){const mid=(low+high)>>1;if(cumulative[mid]<pick)low=mid+1;else high=mid;}
    const [a,b,c]=triangles[low],u=Math.sqrt(rng()),v=rng();
    const point=a.clone().multiplyScalar(1-u).addScaledVector(b,u*(1-v)).addScaledVector(c,u*v);
    if(crossesPaving(point))continue;
    accepted++;
    const key=`${Math.floor(point.x/4)},${Math.floor(point.z/4)}`;
    if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(point);
  }
  const bladeCount=matchMedia('(max-width:760px)').matches?5:8;
  const prototype=bladePrototype(bladeCount),material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95,metalness:0});
  material.name='living-grass-blades';
  material.envMapIntensity=.3;
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;', 'vec3 irradiance = (0.18 + 0.82 * dotNL + 0.25 * max(dot(-geometryNormal, directLight.direction), 0.0)) * directLight.color;'));
  };
  material.customProgramCacheKey=()=> 'thin-grass-translucency-v1';

  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();let batches=0;
  for(const points of cells.values())for(let offset=0;offset<points.length;offset+=2048){
    const chunk=points.slice(offset,offset+2048),mesh=new THREE.InstancedMesh(prototype,material,chunk.length);
    mesh.name='lawn-cell-'+batches++;mesh.castShadow=false;mesh.receiveShadow=true;
    const center=chunk.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/chunk.length);mesh.position.copy(center);
    for(let i=0;i<chunk.length;i++){
      const p=chunk[i].clone().sub(center);p.y+=.002;
      q.setFromAxisAngle(up,rng()*Math.PI*2);
      const scale=.7+rng()*.65;matrix.compose(p,q,new THREE.Vector3(scale,.8+rng()*.5,scale));mesh.setMatrixAt(i,matrix);
      const tone=.78+.12*Math.sin(chunk[i].x*.21+chunk[i].z*.13)+rng()*.2;
      mesh.setColorAt(i,new THREE.Color().setRGB(tone,tone*(.97+rng()*.06),tone*(.88+rng()*.12)));
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();grass.add(mesh);
  }
  scene.add(grass);
  return {grassPatches:accepted,grassBlades:accepted*bladeCount,grassTriangles:accepted*bladeCount*3,grassBatches:batches,maxGrassInstancesPerBatch:2048,trees:config.trees.length,siteMaterials:materials.size,removedDrivewayTriangles,obstacles};
}
