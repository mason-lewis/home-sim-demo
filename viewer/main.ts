import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { createHomeCamera } from './camera';
import '../src/brand.css';
import './style.css';
import { applyBakedIrradiance, createGlass, captureGlassReflections } from './lighting';
import { addLandscape, type ViewerSite } from './landscape';
import { installBlenderDisplay } from './display';
import { customizationShell, installCustomization } from './customize';
import {loadLocalGlb} from './local-model';

const start = performance.now();
const base = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);
const qa = params.has('qa') && params.get('qa') !== 'poster';
if(params.has('fullCanvas'))document.body.classList.add('qa-full-canvas');
if (params.get('qa') === 'poster') document.body.classList.add('poster-capture');
const icon = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const resetIcon = icon('<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>');
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
$('app').innerHTML = `
<main class="viewer" aria-label="Coastal Residence exterior viewer">
  <div id="scene" class="scene" aria-busy="true"></div>
  <header class="masthead"><div class="eyebrow">An exterior study</div><h1>Coastal <em>Residence.</em></h1></header>
  <div class="study">Private architectural model</div>
  ${customizationShell()}
  <div class="hint" id="hint"><span id="hint-text">Drag to rotate · Scroll to zoom.</span></div>
  <footer class="footer"><nav class="toolbar" aria-label="Home viewing controls">
    <button id="zoom-out" disabled aria-label="Zoom out" title="Zoom out">${icon('<path d="M5 12h14"/>')}</button>
    <button id="zoom-in" disabled aria-label="Zoom in" title="Zoom in">${icon('<path d="M5 12h14M12 5v14"/>')}</button>
    <span class="separator" aria-hidden="true"></span><button class="reset" id="reset-view" disabled>${resetIcon}Reset view</button>
  </nav></footer>
  <div class="caption"><span class="tagline">Architecture, from every angle.<br></span>Proposed finishes · Display base is illustrative.</div>
  <section id="loading" class="loading" role="status" aria-live="polite">
    <img class="poster" src="${base}home-preview.webp" alt="Preview of the home's complete exterior" />
    <div class="load-card"><div class="load-label" id="load-label">A home worth a closer look.</div><div class="load-detail" id="load-detail">Preparing your model…</div><div id="progress" class="progress" role="progressbar" aria-label="Loading the home" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="progress-fill" class="progress-fill"></div></div><button class="retry" id="retry" hidden>Try again</button></div>
  </section><div id="live-status" class="live-status" aria-live="polite"></div>
  ${qa ? '<output id="viewer-evidence" style="position:absolute;right:16px;bottom:20px;max-width:280px;max-height:280px;overflow:auto;font:10px/1.4 monospace;white-space:pre-wrap;pointer-events:none"></output>' : ''}
</main>`;

let renderer: THREE.WebGLRenderer;
let view: ReturnType<typeof createHomeCamera> | undefined;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let frame = 0;
let ready = false;
let failed = false;
let framesRendered = 0;
let firstReadyMs = 0;
let modelBytes = 0;
let geometryTriangles = 0;
let meshCount = 0;
let materialCount = 0;
let bakedMeshCount = 0;
let cameraObstacles: THREE.Sphere[] = [];
let nextReportTime = 0;
const frames: number[] = [];
let previousFrame = 0;
let interacting = false;
let hintTimer = 0;
let house: THREE.Group;
let homeBounds: THREE.Box3;
let testResults: unknown;
let sceneConfig: ViewerSite;
let landscapeStats: unknown;
let sceneTotals: unknown;
let gpuInfo: unknown;
let bakedHome: THREE.Texture;
let glassMaterial: THREE.MeshPhysicalMaterial;
let studioEvidence:unknown;

function progress(value: number, detail: string) {
  $('progress').setAttribute('aria-valuenow', String(Math.round(value)));
  $('progress-fill').style.width = `${value}%`;
  $('load-detail').textContent = detail;
}
function fail(message: string) {
  if (failed) return;
  failed = true; ready = false;
  cancelAnimationFrame(frame); frame = 0;
  if (view) view.controls.enabled = false;
  $('scene').setAttribute('aria-busy', 'false');
  $('loading').hidden = false;
  $('loading').className = 'loading error';
  $('loading').setAttribute('role', 'alert');
  $('load-label').textContent = 'The home couldn’t load.';
  $('load-detail').textContent = message;
  $('progress').hidden = true;
  $('retry').hidden = false;
  for (const id of ['zoom-in', 'zoom-out', 'reset-view']) $(id).setAttribute('disabled', '');
  report();
}
$('retry').addEventListener('click', () => location.reload());

async function downloadModel() {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45000);
  try {
    const response = await fetch(`${base}models/exterior-home.glb`, { signal: abort.signal });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length'));
    if (!response.body) return await response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength; chunks.push(value);
      progress(total ? 8 + received / total * 62 : 25, 'Loading the home…');
    }
    modelBytes = received;
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes.buffer;
  } finally { clearTimeout(timer); }
}

/** One sun for direct light. Solar core removed from environment to avoid
 * counting direct energy twice. Baked surfaces suppress live diffuse terms. */
function environment(hdr: THREE.DataTexture) {
  const data = hdr.image.data as Uint16Array;
  for (let i = 0; i < data.length; i += 4) {
    const values = [0, 1, 2].map(c => THREE.DataUtils.fromHalfFloat(data[i + c]));
    const luminance = values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
    const scale = Math.min(1, 12 / Math.max(luminance, .00001));
    for (let c = 0; c < 3; c++) data[i + c] = THREE.DataUtils.toHalfFloat(values[c] * scale);
  }
  hdr.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromEquirectangular(hdr);
  scene.environment = map.texture;
  scene.environmentIntensity = sceneConfig.environmentEnergy;
  scene.environmentRotation.y = sceneConfig.environmentRotation;
  pmrem.dispose();
}

function configureModel() {
  const materials = new Set<THREE.Material>();
  const glass = createGlass();
  glassMaterial = glass;
  house.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    meshCount++;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    const replaced = list.map(material => {
      if (['glass', 'garage-window', 'garage-glass'].includes(material.name)) return glass;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 1;
        applyBakedIrradiance(material, bakedHome);
        for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
          if (texture) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        }
      }
      return material;
    });
    node.material = Array.isArray(node.material) ? replaced : replaced[0];
    if (replaced.some(m => m.userData.bakedDiffuse)) bakedMeshCount++;
    node.castShadow = !replaced.includes(glass);
    node.receiveShadow = !replaced.includes(glass);
    for (const material of replaced) materials.add(material);
    geometryTriangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  materialCount = materials.size;
  homeBounds = new THREE.Box3().setFromObject(house);
  scene.add(house);
}

function resize() {
  if (!renderer) return;
  const { width, height } = $('scene').getBoundingClientRect();
  const previousAspect = camera.aspect;
  camera.aspect = width / height;
  camera.setViewOffset(width, height, 0, height * .065, width, height);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  if (view && Math.abs(previousAspect - camera.aspect) > .001) view.resize();
  requestRender();
}
function requestRender() {
  if (!frame && ready && !failed && !document.hidden) frame = requestAnimationFrame(render);
}
function render(now: number) {
  frame = 0;
  if (!ready || failed || document.hidden) return;
  const changed = view!.controls.update();
  renderer.render(scene, camera); framesRendered++;
  if (interacting && previousFrame) frames.push(now - previousFrame);
  previousFrame = now;
  $('zoom-in').toggleAttribute('disabled', view!.controls.getDistance() <= view!.controls.minDistance + .01);
  $('zoom-out').toggleAttribute('disabled', view!.controls.getDistance() >= view!.controls.maxDistance - .01);
  if (changed || interacting) requestRender();
  report();
}
function report() {
  if (!qa || performance.now() < nextReportTime) return;
  nextReportTime = performance.now() + 200;
  const sorted = [...frames].sort((a, b) => a - b);
  $('viewer-evidence').textContent = JSON.stringify({ state: failed ? 'error' : ready ? 'ready' : 'loading',
    browser: navigator.userAgent, pixels: renderer ? [renderer.domElement.width, renderer.domElement.height] : [],
    dpr: devicePixelRatio, gpu:gpuInfo, modelBytes, readyMs: Math.round(firstReadyMs), meshes: meshCount, materials: materialCount,
    storedTriangles: geometryTriangles, calls: renderer?.info.render.calls, renderedTriangles: renderer?.info.render.triangles,
    framesRendered, framesMeasured: frames.length, p95Ms: sorted.length ? sorted[Math.floor(sorted.length * .95)] : null,
    camera: camera?.position.toArray(), target: view?.target.toArray(), radius: view?.controls.getDistance(),
    minRadius: view?.controls.minDistance, maxRadius: view?.controls.maxDistance,
    architecturePackage: sceneConfig?.architecturePackage, bakedDiffuseMeshes: bakedMeshCount, landscape: landscapeStats, sceneTotals,
    studio:studioEvidence, tests: testResults, resources: performance.getEntriesByType('resource').map(entry => ({url: entry.name, bytes: (entry as PerformanceResourceTiming).decodedBodySize, durationMs: entry.duration})) }, null, 1);
}

async function launch() {
  const loadingTimeout = window.setTimeout(() => fail('Loading is taking longer than expected. Please check your connection and try again.'), 60000);
  try {
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { clearTimeout(loadingTimeout); fail('This browser can’t display 3D. Try an up-to-date Safari, Chrome, Firefox, or Edge with hardware acceleration enabled.'); return; }
    renderer.setClearColor(0x141917, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    if (qa) {
      const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
      gpuInfo={renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),maxTextureSize:renderer.capabilities.maxTextureSize};
    }
    const canvas = renderer.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', '3D home. Drag to rotate, scroll or pinch to zoom. Arrow keys rotate. Plus and minus zoom. Home resets the view.');
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('Your device paused the 3D view. Close other busy tabs, then try again.'); });
    $('scene').append(canvas);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, .08, 1500);
    resize();
    progress(5, 'Finding the right light…');
    const [bytes, hdr, configResponse] = await Promise.all([downloadModel(), new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(`${base}environments/coastal-sky-512.hdr`), fetch(`${base}viewer-scene.json`)]);
    if (!configResponse.ok) throw new Error('Scene settings unavailable');
    sceneConfig = await configResponse.json();
    environment(hdr);
    progress(72, 'Loading the garden and baked daylight…');
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const lightmapLoader = new THREE.TextureLoader();
    // RGBM alpha carries irradiance magnitude, not opacity. Decode without
    // browser premultiplication or color conversion, preserving numeric data.
    const dataLoader = new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' });
    const irradiance = async (url: string) => { const texture = new THREE.Texture(await dataLoader.loadAsync(url)); texture.needsUpdate = true; return texture; };
    const [gltf, site, tree, homeLight, siteLight, displayLUT] = await Promise.all([
      loader.parseAsync(bytes, `${base}models/`),
      loader.loadAsync(`${base}models/landscape-site.glb`),
      loader.loadAsync(`${base}models/landscape-tree.glb`),
      irradiance(`${base}${sceneConfig.homeLightmap}`),
      irradiance(`${base}${sceneConfig.siteLightmap}`),
      lightmapLoader.loadAsync(`${base}lighting/blender-agx.png`),
    ]);
    for (const map of [homeLight, siteLight]) {
      map.flipY = false;
      map.colorSpace = THREE.NoColorSpace;
      map.channel = 1;
      map.minFilter = THREE.LinearFilter;
      map.magFilter = THREE.LinearFilter;
      map.generateMipmaps = false;
      map.needsUpdate = true;
    }
    bakedHome = homeLight;
    house = gltf.scene;
    configureModel();
    const landscape = addLandscape(scene, site.scene, tree.scene, sceneConfig, siteLight);
    cameraObstacles = landscape.obstacles;
    landscapeStats = landscape;
    const geometries = new Set<THREE.BufferGeometry>(), sceneMaterials = new Set<THREE.Material>();
    let sceneMeshes = 0, storedSceneTriangles = 0, instanceBytes = 0;
    scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      sceneMeshes++;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) sceneMaterials.add(material);
      if (node instanceof THREE.InstancedMesh) instanceBytes += node.instanceMatrix.array.byteLength + (node.instanceColor?.array.byteLength ?? 0);
    });
    let geometryBytes = 0;
    for (const geometry of geometries) {
      storedSceneTriangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      geometryBytes += geometry.index?.array.byteLength ?? 0;
      for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array.byteLength;
    }
    sceneTotals = { meshes: sceneMeshes, materials: sceneMaterials.size, uniqueGeometries: geometries.size, uniqueStoredTriangles: storedSceneTriangles, cpuGeometryBytes: geometryBytes, cpuInstanceBytes: instanceBytes };
    progress(90, 'Finishing the reflections…');
    const sun = new THREE.DirectionalLight('#ffffff', sceneConfig.sun.energy);
    const center = homeBounds.getCenter(new THREE.Vector3());
    sun.target.position.copy(center); sun.position.copy(center).add(new THREE.Vector3().fromArray(sceneConfig.sun.direction));
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 100 });
    sun.shadow.bias = -.00008; sun.shadow.normalBias = .025; sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    renderer.shadowMap.needsUpdate = true;
    captureGlassReflections(renderer, scene, house, glassMaterial, hdr);
    hdr.dispose();
    view = createHomeCamera(camera, canvas, homeBounds);
    view.setObstacles(cameraObstacles);
    view.controls.addEventListener('change', requestRender);
    view.controls.addEventListener('start', () => { interacting = true; previousFrame = 0; requestRender(); });
    view.controls.addEventListener('end', () => { interacting = false; previousFrame = 0; requestRender(); });
    const studio=installCustomization({house,site:site.scene,scene,camera,renderer,view,render:requestRender,importModel:async file=>{
      const imported=await loadLocalGlb(await file.arrayBuffer());
      const bounds=new THREE.Box3().setFromObject(imported.scene),size=bounds.getSize(new THREE.Vector3());
      if(bounds.isEmpty()||!Number.isFinite(size.length())||size.length()<.0001)throw Error('This GLB contains no visible 3D model.');
      // Normalize only the temporary imported preview, never the source file.
      const scale=homeBounds.getSize(new THREE.Vector3()).length()/size.length();
      const wrapper=new THREE.Group();wrapper.add(imported.scene);wrapper.scale.setScalar(scale);
      const center=bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale);wrapper.position.copy(homeBounds.getCenter(new THREE.Vector3())).sub(center);
      wrapper.traverse(node=>{if(node instanceof THREE.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])attachDisplay(material);});
      for(const node of scene.children)if(!(node instanceof THREE.Light)&&node.type!=='Object3D')node.visible=false;
      wrapper.visible=true;scene.add(wrapper);document.querySelector('h1')!.textContent=file.name.replace(/\.glb$/i,'');document.querySelector('.caption')!.textContent='Imported model · Stored only on this device.';view!.controls.dispose();view=createHomeCamera(camera,canvas,new THREE.Box3().setFromObject(wrapper));
      view.controls.addEventListener('change',requestRender);view.controls.addEventListener('start',()=>{interacting=true;requestRender();});view.controls.addEventListener('end',()=>{interacting=false;requestRender();});
      renderer.shadowMap.needsUpdate=true;requestRender();
    }});
    const attachDisplay=installBlenderDisplay(scene,displayLUT,[studio.doorPaint,studio.doorGlass,studio.doorHandle]);
    studioEvidence={state:studio.state,originalEntryParts:studio.originalDoorParts};
    const reset = () => { view!.reset(); requestRender(); $('live-status').textContent = 'Starting view restored.'; };
    $('reset-view').addEventListener('click', reset);
    $('zoom-in').addEventListener('click', () => { view!.zoom(.85); requestRender(); });
    $('zoom-out').addEventListener('click', () => { view!.zoom(1 / .85); requestRender(); });
    canvas.addEventListener('keydown', event => {
      if (!view) return;
      const angles: Record<string, [number, number]> = { ArrowLeft: [.12, 0], ArrowRight: [-.12, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] };
      if (angles[event.key]) {
        const [azimuth, polar] = angles[event.key];
        const offset = camera.position.clone().sub(view.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += azimuth;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + polar, view.controls.minPolarAngle, view.controls.maxPolarAngle);
        camera.position.copy(view.target).add(new THREE.Vector3().setFromSpherical(spherical));
        view.controls.update(); requestRender(); event.preventDefault();
      } else if (['+', '=', '-', '_', 'Home', '0'].includes(event.key)) {
        if (event.key === 'Home' || event.key === '0') reset();
        else view.zoom(event.key === '-' || event.key === '_' ? 1 / .85 : .85);
        requestRender(); event.preventDefault();
      }
    });
    const touchHint = () => { $('hint-text').textContent = 'Drag to rotate · Pinch to zoom.'; };
    if (matchMedia('(pointer: coarse)').matches) touchHint();
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') touchHint();
      else $('hint-text').textContent = 'Drag to rotate · Scroll to zoom.';
      clearTimeout(hintTimer); hintTimer = window.setTimeout(() => $('hint').classList.add('dismissed'), 4000);
    });
    await renderer.compileAsync(scene, camera);
    renderer.shadowMap.needsUpdate = true;
    if (failed) { renderer.dispose(); return; }
    clearTimeout(loadingTimeout);
    ready = true; firstReadyMs = performance.now() - start;
    renderer.render(scene, camera); framesRendered++;
    progress(100, 'Ready to explore.');
    $('loading').classList.add('complete');
    setTimeout(() => { if (!failed) $('loading').hidden = true; }, 400);
    $('scene').setAttribute('aria-busy', 'false');
    for (const id of ['zoom-in', 'zoom-out', 'reset-view']) $(id).removeAttribute('disabled');
    $('live-status').textContent = 'Home ready. Drag to rotate. Scroll or pinch to zoom.';
    requestRender(); report();
    if (['exercise','benchmark'].includes(params.get('qa') ?? '')) {
      const { exerciseViewer } = await import('./exercise');
      testResults = await exerciseViewer({ camera, view, canvas, house, homeBounds, renderer, scene, requestRender, lightmaps:[{texture:homeLight,probes:sceneConfig.lightmapProbes.home},{texture:siteLight,probes:sceneConfig.lightmapProbes.site}] }, {sustained:params.get('qa')==='benchmark',onProgress:progress=>{testResults=progress;report();}});
      nextReportTime = 0;report();
    }
  } catch (error) {
    clearTimeout(loadingTimeout);
    console.error('Exterior viewer:', error);
    fail('Please check your connection and try again. If it still won’t load, try another browser.');
  }
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe($('scene'));
document.addEventListener('visibilitychange', () => { previousFrame = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestRender(); });
launch();
