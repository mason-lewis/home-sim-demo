import * as THREE from 'three';
import type {createHomeCamera} from './camera';

/** Repeatable diagnostic views. Enabled only by the explicit qa query flag. */
export function installInspection(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, view: ReturnType<typeof createHomeCamera>, render:()=>void) {
  const poses: Record<string, {eye:number[]; target:number[]}> = {
    'Overview': {eye:[26,16,25],target:[6,4.8,-8]},
    'Front gable': {eye:[6.62,9.6,4.5],target:[6.62,8.65,-2.75]},
    'Entry assembly': {eye:[2.6,1.55,.1],target:[3.27,1.15,-4.03]},
    'Side utility door': {eye:[16,1.3,-10.9],target:[12.1,.85,-10.9]},
    'Right floor band': {eye:[22,5,-7],target:[12.1,2.95,-7]},
    'Front elevation': {eye:[6,6,24],target:[6,5,-8]},
    'Right elevation': {eye:[33,6,-8],target:[6,5,-8]},
    'Rear elevation': {eye:[6,6,-38],target:[6,5,-8]},
    'Left elevation': {eye:[-24,6,-8],target:[6,5,-8]},
    'Roof junctions': {eye:[19,17,-21],target:[6.5,8,-8]},
  };
  const panel=document.createElement('aside');panel.setAttribute('aria-label','Model inspection');
  panel.style.cssText='position:fixed;bottom:12px;left:12px;z-index:100;padding:8px;background:#fff;color:#111;font:12px sans-serif;display:flex;gap:8px;align-items:center';
  panel.innerHTML=`<label>Inspection view <select aria-label="Inspection view">${Object.keys(poses).map(name=>`<option>${name}</option>`).join('')}</select></label><label>Inspection shading <select aria-label="Inspection shading"><option value="final">Final lighting</option><option value="neutral">Neutral geometry</option><option value="materials">Materials without shadows</option></select></label><button>Orbit step</button><label>Step degrees <select aria-label="Orbit step degrees"><option>15</option><option>0.5</option></select></label><button data-design>Design controls</button>`;
  document.body.append(panel);
  const select=panel.querySelector<HTMLSelectElement>('select')!;
  const neutral=new THREE.MeshStandardMaterial({color:'#b8b8b8',roughness:.85});
  select.addEventListener('change',()=>{
    // Close diagnostic cameras are explicit QA views. Overview still exercises
    // the product's normal tree and grade protection during orbit inspection.
    view.setInspectionMode(select.value!=='Overview');
    const pose=poses[select.value];view.controls.enableDamping=false;view.controls.minDistance=.5;view.controls.maxDistance=200;
    view.controls.target.fromArray(pose.target);camera.position.fromArray(pose.eye);view.controls.update();render();
  });
  panel.querySelectorAll('select')[1].addEventListener('change',event=>{
    const mode=(event.target as HTMLSelectElement).value;
    scene.overrideMaterial=mode==='neutral'?neutral:null;
    scene.traverse(node=>{if(node instanceof THREE.Light&&node.castShadow!==undefined&&node.userData.inspectionOriginalShadow===undefined)node.userData.inspectionOriginalShadow=node.castShadow;if(node instanceof THREE.Light)node.castShadow=mode==='final'?!!node.userData.inspectionOriginalShadow:false;});
    renderer.shadowMap.needsUpdate=true;render();
  });
  panel.querySelector('[data-design]')!.addEventListener('click',()=>document.body.classList.toggle('qa-full-canvas'));
  panel.querySelector('button')!.addEventListener('click',()=>{
    const offset=camera.position.clone().sub(view.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),Number(panel.querySelector<HTMLSelectElement>('[aria-label="Orbit step degrees"]')!.value)*Math.PI/180);
    camera.position.copy(view.controls.target).add(offset);view.controls.update();render();
  });
}
