import * as THREE from 'three';
import type {createHomeCamera} from './camera';
import {installDoors, type EntryStyle, type GarageStyle} from './doors';
import type {TimeOfDay} from './lighting';

// Option names and palettes match the supplied Dreamview reference. These are
// proposed finishes; original architectural geometry and source files stay intact.
export const finishOptions={
 house:[['warm-white','Warm white','#deded4'],['cream','Cream','#e5d9bb'],['light-grey','Light grey','#b9bdbb'],['greige','Greige','#aaa396'],['sand','Sand','#c8b18d'],['sage','Sage','#8d9b83'],['coastal-blue','Coastal blue','#7894a1'],['charcoal','Charcoal','#4b5355']],
 roofMaterial:[['metal','Metal'],['asphalt','Asphalt']],
 roofColor:[['black','Black','#252827'],['charcoal','Charcoal','#454b4d'],['grey','Grey','#777d80']],
 doorStyle:[['source','Original'],['full','Full light'],['three-quarter','3/4 light'],['half','1/2 light'],['none','No light']],
 garageStyle:[['source','Original'],['flush','Flush'],['horizontal','Horizontal panels'],['carriage','Carriage'],['glass','Full-view glass']],
 doorColor:[['natural','Natural oak','#746449'],['white','White','#f2f0e9'],['black','Black','#252a28'],['charcoal','Charcoal','#4b5355'],['navy','Navy','#344b60'],['sage','Sage','#8d9b83'],['red','Deep red','#793d37']],
 windows:[['black','Black','#252a28'],['white','White','#f2f0e9']],
 driveway:[['asphalt','Black asphalt','#303432'],['concrete','Grey concrete','#b9b8ad']],
} satisfies Record<string,string[][]>;
type Finish=keyof typeof finishOptions;
const defaults:Record<Finish,string>={house:'warm-white',roofMaterial:'asphalt',roofColor:'charcoal',doorStyle:'source',garageStyle:'source',doorColor:'natural',windows:'black',driveway:'concrete'};
const labels:Record<Finish,string>={house:'House color',roofMaterial:'Roof material',roofColor:'Roof color',doorStyle:'Entry door glass',garageStyle:'Garage door style',doorColor:'Door color (all doors)',windows:'Window frames',driveway:'Driveway'};
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
export function customizationShell(){return `
<button class="customize-toggle" id="customize-toggle" aria-expanded="false" aria-controls="design-panel">Customize <span aria-hidden="true">＋</span></button>
<aside class="design-panel" id="design-panel" aria-label="Home design options">
 <div class="panel-heading"><span class="eyebrow">Your home, your way</span><button id="close-design" aria-label="Close customization">×</button></div>
 <div class="panel-tabs" role="tablist" aria-label="Design tools"><button id="tab-customize" role="tab" aria-selected="true" aria-controls="finish-panel">Customize</button><button id="tab-perspectives" role="tab" aria-selected="false" tabindex="-1" aria-controls="perspective-panel">Perspectives</button></div>
 <section id="finish-panel" role="tabpanel" aria-labelledby="tab-customize"><div class="panel-title"><h2>Make it <em>yours.</em></h2><button id="reset-finishes">Reset</button></div>
 ${Object.entries(finishOptions).map(([key,options])=>`<fieldset data-finish="${key}"><legend>${labels[key as Finish]}</legend><div class="finish-choices">${options.map(([value,label,color])=>`<button data-value="${value}" title="${label}" aria-label="${label}" aria-pressed="${defaults[key as Finish]===value}" ${color?`class="swatch" style="--swatch:${color}"`:''}>${color?`<span aria-hidden="true"></span><small>${label}</small>`:label}</button>`).join('')}</div></fieldset>`).join('')}
 <p class="design-note" id="finish-note">One color for all doors. Garage styles change both garage doors.</p></section>
 <section id="perspective-panel" role="tabpanel" aria-labelledby="tab-perspectives" hidden><div class="panel-title"><h2>Every <em>angle.</em></h2></div><div class="perspective-list">${['Overview','Front entrance','Backyard elevation','Left elevation','Right elevation','Whole site','Street view'].map((label,i)=>`<button data-perspective="${i}" aria-pressed="${i===0}"><span class="view-number">0${i+1}</span>${label}<span aria-hidden="true">↗</span></button>`).join('')}</div><p class="design-note">Model north points toward the backyard. Geographic north is unverified.</p></section>
</aside>
<nav class="presentation-actions" aria-label="Presentation controls"><button id="save-view">Save view</button><button id="email-view">Email PNG</button><button id="fullscreen">Full screen</button></nav>
<div class="mood-control" role="group" aria-label="Time of day"><button data-mood="day" aria-pressed="true">Daylight</button><button data-mood="golden" aria-pressed="false">Golden hour</button><button data-mood="dusk" aria-pressed="false">Dusk</button></div>
<div class="preview-note" id="preview-note" hidden>Low evening sun · Longer shadows.</div>
<dialog id="email-dialog"><button class="dialog-close" aria-label="Close email preview">×</button><span class="eyebrow">A view worth sharing</span><h2>Your home, in a picture.</h2><p>Download the PNG, then attach it to your email. Nothing is uploaded.</p><label>To<input id="email-to" type="email" autocomplete="email" placeholder="name@example.com" /></label><label>Subject<input id="email-subject" value="My Dream View home" /></label><label>Message<textarea id="email-message">Here is the view I saved from Dream View.</textarea></label><div class="dialog-actions"><button id="email-download">Download PNG</button><button id="open-email">Open email draft</button></div><p id="email-status" role="status"></p></dialog>
<div class="design-toast" id="design-toast" role="status" hidden></div>`;}

interface Context{house:THREE.Group;site:THREE.Group;scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;view:ReturnType<typeof createHomeCamera>;render:()=>void;timeOfDay:(mode:TimeOfDay)=>void}
export function installCustomization(ctx:Context){
 const {house,site,scene,camera,renderer,view}=ctx;
 const doors=installDoors(house,scene);
 const mats=new Map<string,Set<THREE.MeshStandardMaterial>>();
 for(const group of [house,site])group.traverse(node=>{if(node instanceof THREE.Mesh)for(const m of Array.isArray(node.material)?node.material:[node.material])if(m instanceof THREE.MeshStandardMaterial){if(!mats.has(m.name))mats.set(m.name,new Set());mats.get(m.name)!.add(m);}});
 const originals=new Map([...mats.values()].flatMap(set=>[...set]).map(m=>[m,{color:m.color.clone(),map:m.map,normalMap:m.normalMap,roughness:m.roughness,metalness:m.metalness}]));
 const state={...defaults};
 const metalNormal=(()=>{const size=128,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=(y*size+x)*4;data.set([x%32<2?185:x%32>29?71:128,128,250,255],at);}const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);t.needsUpdate=true;return t;})();
 const apply=(names:string[],callback:(m:THREE.MeshStandardMaterial)=>void)=>{for(const name of names)for(const m of mats.get(name)??[])callback(m);};
 function choose(key:Finish,value:string){
  state[key]=value;
  const color=finishOptions[key].find(o=>o[0]===value)?.[2];
  if(key==='house')apply(['siding','siding-wide','siding-board'],m=>m.color.set(color!));
  if(key==='windows')apply(['black'],m=>{m.color.set(color!);});
  if(key==='doorColor')doors.color(value,color!);
  if(key==='doorStyle')doors.entryStyle(value as EntryStyle);
  if(key==='garageStyle')doors.garageStyle(value as GarageStyle);
  if(key==='roofColor')apply(['roof'],m=>{m.color.set(color!);m.map=null;m.needsUpdate=true;});
  if(key==='roofMaterial')apply(['roof'],m=>{const original=originals.get(m)!;m.normalMap=value==='metal'?metalNormal:original.normalMap;m.metalness=value==='metal'?.65:original.metalness;m.roughness=value==='metal'?.38:original.roughness;m.needsUpdate=true;});
  if(key==='driveway')apply(['site-driveway'],m=>{const original=originals.get(m)!;m.color.set(value==='asphalt'?'#303432':'#ffffff');m.map=value==='asphalt'?null:original.map;m.roughness=value==='asphalt'?1:original.roughness;m.needsUpdate=true;});
  document.querySelectorAll<HTMLElement>(`[data-finish="${key}"] button`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===value)));
  $('finish-note').textContent='One color for all doors. Garage styles change both garage doors.';
  ctx.render();
 }
 for(const key of Object.keys(finishOptions) as Finish[])document.querySelectorAll<HTMLButtonElement>(`[data-finish="${key}"] button`).forEach(button=>button.addEventListener('click',()=>choose(key,button.dataset.value!)));
 const restoreDoors=()=>{doors.entryStyle('source');doors.garageStyle('source');doors.color('natural','#746449');};
 restoreDoors();
 $('reset-finishes').addEventListener('click',()=>{
  for(const [m,o]of originals){m.color.copy(o.color);m.map=o.map;m.normalMap=o.normalMap;m.roughness=o.roughness;m.metalness=o.metalness;m.needsUpdate=true;}
  Object.assign(state,defaults);restoreDoors();
  document.querySelectorAll<HTMLElement>('[data-finish] button').forEach(button=>button.setAttribute('aria-pressed',String(state[button.closest<HTMLElement>('[data-finish]')!.dataset.finish as Finish]===button.dataset.value)));
  ctx.render();
 });
 const panel=$('design-panel'),toggle=$('customize-toggle');
 // Keep the phone's essential orbit controls visible; secondary presentation
 // actions live in the scrollable drawer so they never cover the architecture.
 const mobile=matchMedia('(max-width:760px)'),actions=document.querySelector<HTMLElement>('.presentation-actions')!,moods=document.querySelector<HTMLElement>('.mood-control')!,preview=$('preview-note');
 const presentation=document.createElement('section');presentation.className='mobile-presentation';presentation.innerHTML='<h3>Presentation</h3>';panel.append(presentation);
 const placePresentation=()=>{const destination=mobile.matches?presentation:panel.parentElement!;destination.append(moods,preview,actions);};
 mobile.addEventListener('change',placePresentation);placePresentation();
 const closePanel=()=>{panel.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='Customize <span aria-hidden="true">＋</span>';toggle.focus();};
 toggle.addEventListener('click',()=>{const open=panel.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.innerHTML=open?'Done <span aria-hidden="true">×</span>':'Customize <span aria-hidden="true">＋</span>';});$('close-design').addEventListener('click',closePanel);
 panel.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();});
 const tabs=['customize','perspectives'];const selectTab=(name:string)=>{for(const tab of tabs){const active=tab===name;const button=$('tab-'+tab);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$(tab==='customize'?'finish-panel':'perspective-panel').hidden=!active;}};
 for(const name of tabs){$('tab-'+name).addEventListener('click',()=>selectTab(name));$('tab-'+name).addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const next=tabs.find(t=>t!==name)!;selectTab(next);$('tab-'+next).focus();event.preventDefault();}});}
 document.querySelectorAll<HTMLButtonElement>('[data-perspective]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.perspective);const angles=[[.57,.29],[0,.10],[Math.PI,.12],[-Math.PI/2,.12],[Math.PI/2,.12],[.66,.58],[.32,-.1]];const [theta,elevation]=angles[index];view.reset();const direction=new THREE.Vector3(Math.sin(theta)*Math.cos(elevation),Math.sin(elevation),Math.cos(theta)*Math.cos(elevation));let radius=Math.max(view.controls.minDistance,view.startDistance*(index===0?1:.83));if(index===5){const bounds=new THREE.Box3().setFromObject(site),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right),tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const delta=new THREE.Vector3(x,y,z).sub(view.target);radius=Math.max(radius,delta.dot(direction)+Math.abs(delta.dot(right))/tanH,delta.dot(direction)+Math.abs(delta.dot(up))/tanV);}radius*=1.12;view.controls.maxDistance=Math.max(view.controls.maxDistance,radius);}camera.position.copy(view.target).addScaledVector(direction,radius);if(index===6)camera.position.y=new THREE.Box3().setFromObject(house).min.y+1.6;view.controls.update();document.querySelectorAll<HTMLElement>('[data-perspective]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));ctx.render();}));
 document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(button=>button.addEventListener('click',()=>{
  const mood=button.dataset.mood as TimeOfDay;ctx.timeOfDay(mood);
  $('preview-note').hidden=mood==='day';$('preview-note').textContent=mood==='dusk'?'Blue hour · Interior lights on.':'Low evening sun · Longer shadows.';
  document.querySelectorAll<HTMLElement>('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));ctx.render();
 }));
 let toastTimer=0;function toast(message:string){$('design-toast').textContent=message;$('design-toast').hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('design-toast').hidden=true,6000);}
 async function png(){renderer.render(scene,camera);const source=renderer.domElement;const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const c=canvas.getContext('2d')!;c.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()||'#141917';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(source,0,0);return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Unable to save view')),'image/png'));}
 async function download(){try{const blob=await png(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='dream-view-home.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Your view is ready in Downloads.');}catch{toast('This browser could not save the picture. Please try again.');}}
 $('save-view').addEventListener('click',download);
 const dialog=$<HTMLDialogElement>('email-dialog');$('email-view').addEventListener('click',()=>dialog.showModal());dialog.querySelector('button')!.addEventListener('click',()=>dialog.close());$('email-download').addEventListener('click',download);
 $('open-email').addEventListener('click',()=>{const to=$<HTMLInputElement>('email-to');if(!to.reportValidity())return;const subject=$<HTMLInputElement>('email-subject').value,body=$<HTMLTextAreaElement>('email-message').value;location.href=`mailto:${encodeURIComponent(to.value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;$('email-status').textContent='Attach the downloaded PNG in your email app before sending.';});
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Full screen is unavailable in this browser.');}});document.addEventListener('fullscreenchange',()=>$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen');
 return {state,doors};
}
