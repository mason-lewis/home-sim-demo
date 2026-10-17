import * as THREE from 'three';
import { applyBakedIrradiance } from './lighting';
export interface ViewerSite {
  architecturePackage: string;
  trees: {id:number;position:number[];scale:number[];yaw:number;tone:number}[];
  grassTriangles: number[][][];
  grassExclusions?:number[][][]; grassEdgeClearance?:number;
  homeLightmap: string; siteLightmap: string;
  lightmapProbes: {home:LightmapProbes;site:LightmapProbes};
  sun: { direction: number[]; energy:number; angularDiameter:number };
  environmentEnergy:number; environmentRotation:number; ground:number;
}
export interface LightmapProbes {width:number;height:number;samples:{x:number;y:number;rgba:number[]}[]}
const up = new THREE.Vector3(0,1,0);
function randomGenerator(seed:number) { return () => { seed = (Math.imul(seed,1664525)+1013904223)|0; return (seed>>>0)/4294967296; }; }

/** Nine-triangle patch: three tapered curved blades. Real geometry supplies
 * silhouettes; the licensed full-scale turf texture supplies the dense underlay.
 */
function bladePrototype() {
  const positions:number[] = [], colors:number[] = [], indices:number[]=[];
  for (let blade=0;blade<3;blade++) {
    const yaw=blade*2.39996, height=.072+blade*.015, width=.0065;
    const side=new THREE.Vector3(Math.cos(yaw)*width,0,Math.sin(yaw)*width);
    const lean=new THREE.Vector3(-Math.sin(yaw)*.033,height,Math.cos(yaw)*.033);
    const mid=lean.clone().multiplyScalar(.55); mid.y=height*.62;
    const vs=[side.clone().negate(),side,mid.clone().addScaledVector(side,-.65),mid.clone().addScaledVector(side,.65),lean];
    const offset=positions.length/3;
    for(let i=0;i<vs.length;i++) {
      positions.push(...vs[i].toArray());
      const c=new THREE.Color().setRGB(.11,.19,.035).multiplyScalar(i<2?.58:i===4?1.25:1);
      colors.push(c.r,c.g,c.b);
    }
    indices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2,offset+2,offset+3,offset+4);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
export function addLandscape(scene:THREE.Scene, site:THREE.Group, tree:THREE.Group, config:ViewerSite, irradiance:THREE.Texture) {
  const materials=new Set<THREE.Material>();
  site.traverse(node => {
    if (!(node instanceof THREE.Mesh))return;
    const ms=Array.isArray(node.material)?node.material:[node.material];
    for(const material of ms)if(material instanceof THREE.MeshStandardMaterial){
      material.side=THREE.FrontSide;
      applyBakedIrradiance(material,irradiance);
      for(const tex of [material.map,material.normalMap,material.roughnessMap])if(tex)tex.anisotropy=8;
      materials.add(material);
    }
    node.receiveShadow=false;node.castShadow=false;
  });
  scene.add(site);
  tree.traverse(node => {
    if (!(node instanceof THREE.Mesh))return;
    node.castShadow=true;node.receiveShadow=true;
    for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof THREE.MeshStandardMaterial){
      if(material.name==='tree-leaf') {
        material.transparent=false;material.alphaTest=.05;material.alphaToCoverage=false;material.side=THREE.DoubleSide;
        material.roughness=.88;material.metalness=0;
        material.emissiveMap=null;material.emissive.setRGB(0,0,0);
      }
      for(const tex of [material.map,material.normalMap,material.roughnessMap])if(tex)tex.anisotropy=4;
    }
  });
  const obstacles: THREE.Sphere[] = [];
  for(const placement of config.trees){
    const plant=tree.clone(true);plant.name='retained-tree-'+placement.id;
    // Match the derived Blender scene's interpreted tree orientation exactly.
    plant.position.fromArray(placement.position);plant.scale.fromArray(placement.scale);plant.rotation.y=-placement.yaw;
    scene.add(plant);plant.updateMatrixWorld(true);
    obstacles.push(new THREE.Box3().setFromObject(plant).getBoundingSphere(new THREE.Sphere()));
  }
  const rng=randomGenerator(261016), grass=new THREE.Group();grass.name='individual-lawn-blades';
  const triangles=config.grassTriangles.map(v=>v.map(p=>new THREE.Vector3().fromArray(p)));
  const areas=triangles.map(([a,b,c])=>new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).length()*.5);
  const area=areas.reduce((a,b)=>a+b,0),count=Math.min(24576,Math.ceil(area*65));
  const cumulative:number[]=[];areas.reduce((sum,a)=>{cumulative.push(sum+a);return sum+a;},0);
  const clearance=config.grassEdgeClearance??.1;
  const exclusions=(config.grassExclusions??[]).map(poly=>({poly,minX:Math.min(...poly.map(p=>p[0]))-clearance,maxX:Math.max(...poly.map(p=>p[0]))+clearance,minZ:Math.min(...poly.map(p=>p[2]))-clearance,maxZ:Math.max(...poly.map(p=>p[2]))+clearance}));
  const crossesPaving=(point:THREE.Vector3)=>exclusions.some(({poly,minX,maxX,minZ,maxZ})=>{
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
  const prototype=bladePrototype(),material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.9,metalness:0});
  material.name='living-grass-blades';
  material.emissive.setRGB(.018,.026,.006);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();let batches=0;
  for(const points of cells.values())for(let offset=0;offset<points.length;offset+=256){
    const chunk=points.slice(offset,offset+256),mesh=new THREE.InstancedMesh(prototype,material,chunk.length);
    mesh.name='lawn-cell-'+batches++;mesh.castShadow=false;mesh.receiveShadow=true;
    const center=chunk.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/chunk.length);mesh.position.copy(center);
    for(let i=0;i<chunk.length;i++){
      const p=chunk[i].clone().sub(center);p.y+=.002;
      q.setFromAxisAngle(up,rng()*Math.PI*2);
      const scale=.7+rng()*.6;matrix.compose(p,q,new THREE.Vector3(scale,.8+rng()*.5,scale));mesh.setMatrixAt(i,matrix);
      const tone=.8+.2*Math.sin(chunk[i].x*.21+chunk[i].z*.13)+rng()*.15;
      mesh.setColorAt(i,new THREE.Color().setRGB(tone,tone,tone));
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();grass.add(mesh);
  }
  scene.add(grass);
  return {grassPatches:accepted,grassBlades:accepted*3,grassTriangles:accepted*9,grassBatches:batches,maxGrassInstancesPerBatch:256,trees:config.trees.length,siteMaterials:materials.size,obstacles};
}
