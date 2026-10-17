import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';

export type TimeOfDay = 'day' | 'golden' | 'dusk';
export const lightingPresets = {
  day: {sun: [-32, 48, 30], color: '#fff4e8', intensity: 3.1, ambient: .82, exposure: .95, elevation: 48, sky: '#c2d8eb', ground: '#747761', fill: .3, interior: 0},
  golden: {sun: [-55, 9, 18], color: '#ffbd7d', intensity: 3.2, ambient: .35, exposure: 1.1, elevation: 9, sky: '#b6c4e1', ground: '#736650', fill: .28, interior: 0},
  dusk: {sun: [-55, -5, 18], color: '#e8a7a0', intensity: 0, ambient: .55, exposure: 1.8, elevation: -5, sky: '#9db1db', ground: '#5d6070', fill: .65, interior: 48},
} as const;

export function applyOcclusion(material: THREE.MeshStandardMaterial, texture: THREE.Texture) {
  material.lightMap = null;
  material.aoMap = texture;
  material.aoMapIntensity = .85;
  material.userData.contactOcclusion = true;
}

export function createGlass() {
  const glass = new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: .065, transmission: 1,
    thickness: .018, ior: 1.5, attenuationColor: new THREE.Color('#f0f5ee'), attenuationDistance: 30,
    envMapIntensity: 1, side: THREE.FrontSide});
  glass.name = 'viewer-thin-glass';
  return glass;
}

/** Spend shadow texels on the house; retain upstream space for tree casters. */
export function fitHouseShadow(sun: THREE.DirectionalLight, bounds: THREE.Box3) {
  sun.updateMatrixWorld(true); sun.target.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  const projected=new THREE.Box3();
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
    projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(sun.shadow.camera.matrixWorldInverse));
  }
  Object.assign(sun.shadow.camera,{
    left:projected.min.x-2,right:projected.max.x+2,bottom:projected.min.y-2,top:projected.max.y+2,
    near:Math.max(.1,-projected.max.z-30),far:-projected.min.z+10,
  });
  sun.shadow.camera.updateProjectionMatrix();
}

/** Only local occlusion is baked. The sun and its shadows are evaluated live. */
export function applyTimeOfDay(mode: TimeOfDay, sun: THREE.DirectionalLight, fill: THREE.HemisphereLight, scene: THREE.Scene, renderer: Pick<THREE.WebGLRenderer, 'toneMappingExposure'>, center: THREE.Vector3) {
  const preset = lightingPresets[mode];
  sun.position.copy(center).add(new THREE.Vector3(...preset.sun));
  sun.target.position.copy(center);
  sun.color.set(preset.color); sun.intensity = preset.intensity;
  fill.color.set(preset.sky); fill.groundColor.set(preset.ground); fill.intensity = preset.fill;
  scene.environmentIntensity = preset.ambient;
  renderer.toneMappingExposure = preset.exposure;
}

function reflectionProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene, glass: THREE.MeshPhysicalMaterial, sky: THREE.Texture) {
  const hidden: THREE.Mesh[] = [];
  scene.traverse(node => {
    if (node instanceof THREE.Mesh && (Array.isArray(node.material) ? node.material : [node.material]).includes(glass) && node.visible) { hidden.push(node); node.visible = false; }
  });
  const background = scene.background, rotation = scene.backgroundRotation.clone(), intensity = scene.backgroundIntensity;
  scene.background = sky; scene.backgroundRotation.copy(scene.environmentRotation); scene.backgroundIntensity = 1;
  const target = new THREE.WebGLCubeRenderTarget(128, {type: THREE.HalfFloatType});
  const camera = new THREE.CubeCamera(.1, 180, target); camera.position.set(6, 4.8, 1.1); camera.update(renderer, scene);
  const generator = new THREE.PMREMGenerator(renderer), environment = generator.fromCubemap(target.texture);
  generator.dispose(); target.dispose();
  scene.background = background; scene.backgroundRotation.copy(rotation); scene.backgroundIntensity = intensity;
  hidden.forEach(node => { node.visible = true; });
  glass.envMap = environment.texture;
  return environment;
}

export function createDaylight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, bounds: THREE.Box3, glass: THREE.MeshPhysicalMaterial, hdr: THREE.DataTexture) {
  // Remove the HDR's solar core; the directional light supplies direct sun once.
  const data = hdr.image.data as Uint16Array;
  for (let i = 0; i < data.length; i += 4) {
    const channels = [0, 1, 2].map(c => THREE.DataUtils.fromHalfFloat(data[i + c]));
    const luminance = channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
    const scale = Math.min(1, 8 / Math.max(luminance, .00001));
    for (let c = 0; c < 3; c++) data[i + c] = THREE.DataUtils.toHalfFloat(channels[c]*scale);
  }
  hdr.needsUpdate = true;
  const center = bounds.getCenter(new THREE.Vector3());
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  const resolution = matchMedia('(max-width:760px)').matches ? 2048 : 4096;
  sun.shadow.mapSize.set(resolution, resolution);
  Object.assign(sun.shadow.camera, {left: -33, right: 33, top: 30, bottom: -30, near: 1, far: 145});
  sun.shadow.bias = -.00005; sun.shadow.normalBias = .004; sun.shadow.radius = 2.2;
  const fill = new THREE.HemisphereLight();
  scene.add(sun, sun.target, fill);
  const interior = new THREE.Group(); interior.name = 'evening-architectural-lights'; scene.add(interior);
  for (const [position, target] of [
    [[3.27, 2.4, -3.7], [3.27, -.3, -3.7]],
    [[8.2, 5.5, -1.3], [8.2, 2.85, -1.8]],
    [[3.4, 8.7, -7.6], [3.4, 6.2, -7.6]],
  ]) {
    const light = new THREE.SpotLight('#ffd3a1', 0, 8, 1.1, .75, 2);
    light.position.fromArray(position); light.target.position.fromArray(target);
    light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.normalBias = .015;
    interior.add(light, light.target);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const environments = new Map<TimeOfDay, {map: THREE.WebGLRenderTarget; sky: THREE.Texture; rotation: number}>();
  environments.set('day', {map: generator.fromEquirectangular(hdr), sky: hdr, rotation: 1.15});
  let current: TimeOfDay = 'day', reflection: THREE.WebGLRenderTarget | undefined;
  function set(mode: TimeOfDay) {
    current = mode;
    if (!environments.has(mode)) {
      const skyScene = new THREE.Scene(), sky = new Sky(); sky.scale.setScalar(10000);
      sky.material.uniforms.turbidity.value = mode === 'golden' ? 4 : 2;
      sky.material.uniforms.rayleigh.value = mode === 'golden' ? 2 : 3;
      sky.material.uniforms.mieCoefficient.value = .003;
      sky.material.uniforms.mieDirectionalG.value = .8;
      sky.material.uniforms.sunPosition.value.copy(new THREE.Vector3(...lightingPresets[mode].sun).normalize());
      // The visible solar disk is omitted from IBL to avoid counting the sun twice.
      sky.material.fragmentShader = sky.material.fragmentShader.replace('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', '');
      skyScene.add(sky);
      const cube = new THREE.WebGLCubeRenderTarget(128, {type: THREE.HalfFloatType});
      new THREE.CubeCamera(1, 20000, cube).update(renderer, skyScene);
      environments.set(mode, {map: generator.fromCubemap(cube.texture), sky: cube.texture, rotation: 0});
      sky.geometry.dispose(); sky.material.dispose();
    }
    const environment = environments.get(mode)!;
    scene.environment = environment.map.texture; scene.environmentRotation.y = environment.rotation;
    applyTimeOfDay(mode, sun, fill, scene, renderer, center);
    fitHouseShadow(sun,bounds);
    interior.traverse(node => { if (node instanceof THREE.SpotLight) { node.intensity = lightingPresets[mode].interior; node.visible = mode === 'dusk'; } });
    renderer.shadowMap.needsUpdate = true;
    reflection?.dispose(); reflection = reflectionProbe(renderer, scene, glass, environment.sky);
    renderer.shadowMap.needsUpdate = true;
  }
  set('day');
  return {set, sun, fill, interior, get current() {return current;}};
}
