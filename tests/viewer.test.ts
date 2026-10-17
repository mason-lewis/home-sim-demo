import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {beforeAll, beforeEach, afterEach, expect, test, vi} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';
import {installDoors, garageOpenings, type GarageStyle} from '../viewer/doors';
import {addLandscape, type ViewerSite} from '../viewer/landscape';
import {applyOcclusion, applyTimeOfDay, lightingPresets, fitHouseShadow} from '../viewer/lighting';
import {triangleCenter} from '../viewer/geometry';
import {createHomeCamera} from '../viewer/camera';

let home: THREE.Group, site: THREE.Group, tree: THREE.Group, config: ViewerSite;
async function runtimeModel(name: string) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // Exercise the actual compressed geometry. Texture decoding belongs to browser QA.
  loader.register(parser => ({name: 'TEST_GEOMETRY', loadMaterial: async (index: number) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = parser.json.materials[index].name;
    return material;
  }}));
  const bytes = await readFile(resolve(`public/browser-demo/models/${name}.glb`));
  const data = new ArrayBuffer(bytes.length); new Uint8Array(data).set(bytes);
  return (await loader.parseAsync(data, '')).scene;
}
beforeAll(async () => {
  [home, site, tree] = await Promise.all(['exterior-home', 'landscape-site', 'landscape-tree'].map(runtimeModel));
  config = JSON.parse(await readFile(resolve('public/browser-demo/viewer-scene.json'), 'utf8'));
});
beforeEach(() => vi.stubGlobal('matchMedia', () => ({matches: true})));
afterEach(() => vi.unstubAllGlobals());

function doorStudio() {
  const scene = new THREE.Scene(), house = home.clone(true);
  scene.add(house);
  return {house, doors: installDoors(house, scene)};
}

test('one door color reaches entry, interior, patio and both garages while preserving window materials and rail caps', () => {
  let originalRailTriangles=0;
  home.traverse(node=>{if(node instanceof THREE.Mesh&&!Array.isArray(node.material)&&node.material.name==='joinery')originalRailTriangles+=node.geometry.index!.count/3;});
  const {house, doors} = doorStudio();
  expect(doors.entryOriginal.length).toBe(2);
  expect(doors.garageOriginal.length).toBe(2);
  expect(doors.doorMembers).toBeGreaterThan(38);
  doors.color('navy', '#344b60');
  expect(doors.colored.length).toBeGreaterThan(2);
  expect(doors.colored.every(part => part.material === doors.paint)).toBe(true);
  expect(doors.paint.color.getHexString()).toBe('344b60');
  expect(doors.newPaint.color.getHexString()).toBe('344b60');
  let railTriangles = 0, windowSurfaces = 0;
  house.traverse(node => {
    if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) return;
    if (node.material.name === 'joinery') railTriangles += node.geometry.index!.count/3;
    if (node.material.name === 'black' && node.geometry.index!.count) {
      windowSurfaces++;
      expect((node.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ffffff');
    }
  });
  // Repairs may subdivide cap faces. All exported non-door joinery must survive
  // door painting, regardless of its triangulation.
  expect(originalRailTriangles).toBeGreaterThan(0);
  expect(railTriangles).toBe(originalRailTriangles);
  expect(windowSurfaces).toBeGreaterThan(0);
});

test('every garage style replaces both openings, keeps the selected color, and can restore original geometry', () => {
  const {doors} = doorStudio(), counts = new Set<number>();
  doors.color('red', '#793d37');
  for (const style of ['flush', 'horizontal', 'carriage', 'glass'] as GarageStyle[]) {
    doors.garageStyle(style);
    expect(doors.garageOriginal.every(part => !part.visible)).toBe(true);
    const meshes = doors.garages.children as THREE.Mesh[];
    counts.add(meshes.length);
    expect(meshes.some(mesh => mesh.position.x < 8.2)).toBe(true);
    expect(meshes.some(mesh => mesh.position.x > 8.7)).toBe(true);
    expect(doors.newPaint.color.getHexString()).toBe('793d37');
    const bounds = new THREE.Box3().setFromObject(doors.garages);
    expect(bounds.min.x).toBeCloseTo(garageOpenings[0].left, 1);
    expect(bounds.max.x).toBeCloseTo(garageOpenings[1].right, 1);
    expect(bounds.min.y).toBeCloseTo(garageOpenings[0].bottom, 1);
    expect(bounds.max.y).toBeCloseTo(garageOpenings[0].top, 1);
  }
  expect(counts.size).toBe(4);
  doors.garageStyle('source');
  expect(doors.garages.children).toHaveLength(0);
  expect(doors.garageOriginal.every(part => part.visible)).toBe(true);
});

test('door glass styles and restoring the source keep the shared color', () => {
  const {doors} = doorStudio();
  doors.color('sage', '#8d9b83');
  doors.entryStyle('full');
  expect(doors.entryOriginal.every(part => !part.visible)).toBe(true);
  expect((doors.entry.children as THREE.Mesh[]).some(mesh => mesh.material === doors.glass)).toBe(true);
  doors.entryStyle('none');
  expect((doors.entry.children as THREE.Mesh[]).some(mesh => mesh.material === doors.glass)).toBe(false);
  doors.entryStyle('source');
  expect(doors.entryOriginal.every(part => part.visible)).toBe(true);
  expect(doors.paint.color.getHexString()).toBe('8d9b83');
});

test('time of day moves and recolors the actual sun, adjusts exposure, and removes direct sun at dusk', () => {
  const sun = new THREE.DirectionalLight(), sky = new THREE.HemisphereLight(), scene = new THREE.Scene();
  const renderer = {toneMappingExposure: 1}, center = new THREE.Vector3(6, 4, -8);
  applyTimeOfDay('day', sun, sky, scene, renderer, center);
  const daylightHeight = sun.position.y, daylightColor = sun.color.clone();
  applyTimeOfDay('golden', sun, sky, scene, renderer, center);
  expect(sun.position.y).toBeLessThan(daylightHeight);
  expect(sun.color.b).toBeLessThan(daylightColor.b);
  expect(sun.intensity).toBeGreaterThan(0);
  applyTimeOfDay('dusk', sun, sky, scene, renderer, center);
  expect(sun.intensity).toBe(0);
  expect(sky.color.b).toBeGreaterThan(sky.color.r);
  expect(lightingPresets.dusk.interior).toBeGreaterThan(0);
  const material = new THREE.MeshStandardMaterial({lightMap: new THREE.Texture()});
  applyOcclusion(material, new THREE.Texture());
  expect(material.lightMap).toBeNull();
  expect(material.aoMap).not.toBeNull();
});

test('the far driveway becomes grass, this home’s driveway stays, and denser grass remains spatially batched', () => {
  const scene = new THREE.Scene(), landscape = site.clone(true);
  const result = addLandscape(scene, landscape, tree.clone(true), config, new THREE.Texture());
  expect(result.removedDrivewayTriangles).toBeGreaterThan(0);
  expect(result.grassPatches).toBeGreaterThan(24576);
  expect(result.grassBatches).toBeLessThan(180);
  let retainedDriveway = 0, restoredLawn = 0;
  landscape.updateMatrixWorld(true);
  landscape.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.name === 'restored-lawn-across-street') restoredLawn++;
    if ((node.material as THREE.Material).name !== 'site-driveway') return;
    for (let offset=0; offset<node.geometry.index!.count; offset+=3) {
      const center = triangleCenter(node, offset);
      expect(center.z).toBeLessThanOrEqual(29.01864 - (center.x+8)*.01717 + .08);
      retainedDriveway++;
    }
  });
  expect(retainedDriveway).toBeGreaterThan(50);
  expect(restoredLawn).toBeGreaterThan(0);
});

test('low street-level orbits stay above grade and outside the house and tree crowns', () => {
  const bounds = new THREE.Box3().setFromObject(home);
  const camera = new THREE.PerspectiveCamera(40, 1.5, .1, 200);
  const view = createHomeCamera(camera, document.createElement('canvas'), bounds);
  view.controls.enableDamping = false;
  const tree = new THREE.Sphere(new THREE.Vector3(20, 6, 10), 9);
  view.setObstacles([tree]);
  for (let azimuth=0; azimuth<Math.PI*2; azimuth+=.1) {
    camera.position.copy(view.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(view.startDistance, view.controls.maxPolarAngle, azimuth)));
    view.controls.update();
    expect(camera.position.y).toBeGreaterThanOrEqual(bounds.min.y+1.59);
    expect(bounds.clone().expandByScalar(camera.near).containsPoint(camera.position)).toBe(false);
    expect(camera.position.distanceTo(tree.center)).toBeGreaterThanOrEqual(tree.radius+.3);
  }
  view.controls.dispose();
});


test('shadow projection covers every house corner in daytime and low sun',()=>{
  const bounds=new THREE.Box3().setFromObject(home), sun=new THREE.DirectionalLight();
  for(const mode of ['day','golden'] as const){
    applyTimeOfDay(mode,sun,new THREE.HemisphereLight(),new THREE.Scene(),{toneMappingExposure:1},bounds.getCenter(new THREE.Vector3()));
    fitHouseShadow(sun,bounds);
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const projected=new THREE.Vector3(x,y,z).project(sun.shadow.camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);expect(Math.abs(projected.y)).toBeLessThan(1);expect(Math.abs(projected.z)).toBeLessThan(1);
    }
  }
});
