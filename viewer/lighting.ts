import * as THREE from 'three';

/** Diffuse irradiance is baked once in Cycles. Suppress the matching live
 * diffuse terms, while retaining live BRDF specular and clear glass reflections.
 * Pinned Three r180 chunks are checked, so upgrades cannot silently double light.
 */
export function applyBakedIrradiance(material: THREE.MeshStandardMaterial, map: THREE.Texture) {
  material.lightMap = map;
  material.lightMapIntensity = Math.PI;
  material.userData.bakedDiffuse = true;
  material.onBeforeCompile = shader => {
    const directLine = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
    const envLine = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
    if (!THREE.ShaderChunk.lights_physical_pars_fragment.includes(directLine) || !THREE.ShaderChunk.lights_fragment_maps.includes(envLine)) {
      throw new Error('Baked daylight shader contract changed. Revalidate diffuse separation.');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(directLine, '// Direct diffuse already in Cycles atlas.'))
      .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps.replace(envLine, '// Sky diffuse already in Cycles atlas.').replace('lightMapTexel.rgb * lightMapIntensity', 'lightMapTexel.rgb * (lightMapTexel.a * 8.0) * lightMapIntensity'));
  };
  material.customProgramCacheKey = () => 'cycles-rgbm-diffuse-only-v2';
  material.needsUpdate = true;
}

/** Glass has actual IOR/transmission, low roughness, and thin optical thickness.
 * Exterior and interior are still one intact, opaque architectural shell. */
export function createGlass() {
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0,
    roughness: .055, transmission: 1, thickness: .012, ior: 1.5, transparent: false,
    attenuationColor: new THREE.Color('#eff7f3'), attenuationDistance: 30,
    envMapIntensity: 1, side: THREE.FrontSide });
  glass.name = 'viewer-thin-glass';
  return glass;
}

/** Capture nearby trees, grass, and architecture once for exterior glazing.
 * A single probe is an approximation across the whole house, not ray tracing. */
export function captureGlassReflections(renderer: THREE.WebGLRenderer, scene: THREE.Scene, house: THREE.Object3D, glass: THREE.MeshPhysicalMaterial, sky: THREE.Texture) {
  const hidden: THREE.Object3D[] = [];
  house.traverse(node => {
    if (node instanceof THREE.Mesh && (Array.isArray(node.material) ? node.material : [node.material]).includes(glass)) {
      hidden.push(node); node.visible = false;
    }
  });
  const oldBackground = scene.background;
  const oldRotation = scene.backgroundRotation.clone();
  const oldIntensity = scene.backgroundIntensity;
  // PMREM's sky lights reflections outside the finite model base.
  const background = sky;
  scene.background = background;
  scene.backgroundRotation.copy(scene.environmentRotation);
  scene.backgroundIntensity = scene.environmentIntensity;
  const target = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const camera = new THREE.CubeCamera(.1, 150, target);
  camera.position.set(6, 4.8, 1.1);
  camera.update(renderer, scene);
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromCubemap(target.texture);
  glass.envMap = environment.texture;
  generator.dispose(); target.dispose();
  scene.background = oldBackground;
  scene.backgroundRotation.copy(oldRotation);
  scene.backgroundIntensity = oldIntensity;
  for (const node of hidden) node.visible = true;
  return environment;
}
