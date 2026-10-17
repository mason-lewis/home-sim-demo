import * as THREE from 'three';

/** Same Blender AgX Medium High Contrast transform as the source reference.
 * 64³ logarithmic LUT, two filtered strip samples per shaded fragment.
 * Shader returns linear sRGB for Three's final display encoding.
 */
export function installBlenderDisplay(scene: THREE.Scene, lut: THREE.Texture, additional: THREE.Material[] = []) {
  lut.colorSpace = THREE.NoColorSpace;
  lut.flipY = true;
  lut.minFilter = lut.magFilter = THREE.LinearFilter;
  lut.generateMipmaps = false;
  lut.needsUpdate = true;
  const original = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (!THREE.ShaderChunk.tonemapping_pars_fragment.includes(original)) throw new Error('Display shader contract changed. Revalidate Blender display LUT.');
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(original, `
uniform sampler2D viewerDisplayLUT;
vec3 CustomToneMapping( vec3 color ) {
  vec3 p = clamp((log2(max(color * toneMappingExposure, vec3(0.000244140625))) + 12.0) / 20.0, 0.0, 1.0) * 63.0;
  float slice = floor(p.b);
  vec2 uv = vec2((p.r + 0.5 + slice * 64.0) / 4096.0, (p.g + 0.5) / 64.0);
  vec2 uvNext = vec2((p.r + 0.5 + min(slice + 1.0, 63.0) * 64.0) / 4096.0, uv.y);
  vec3 encoded = mix(texture2D(viewerDisplayLUT, uv).rgb, texture2D(viewerDisplayLUT, uvNext).rgb, fract(p.b));
  return mix(pow((encoded + 0.055) / 1.055, vec3(2.4)), encoded / 12.92, lessThanEqual(encoded, vec3(0.04045)));
}`);
  const materials = new Set<THREE.Material>(additional);
  scene.traverse(node => {
    if (node instanceof THREE.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
  });
  const attach = (material:THREE.Material) => {
    const compile = material.onBeforeCompile.bind(material);
    const cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => { compile(shader, renderer); shader.uniforms.viewerDisplayLUT = { value: lut }; };
    material.customProgramCacheKey = () => cacheKey + '-blender-agx64-v1';
    material.needsUpdate = true;
  };
  for(const material of materials) attach(material);
  return attach;
}
