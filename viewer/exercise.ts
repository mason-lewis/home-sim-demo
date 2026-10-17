import * as THREE from 'three';
import type { createHomeCamera } from './camera';
interface Viewer {camera:THREE.PerspectiveCamera;view:ReturnType<typeof createHomeCamera>;canvas:HTMLCanvasElement;house:THREE.Group;homeBounds:THREE.Box3;renderer:THREE.WebGLRenderer;scene:THREE.Scene;requestRender:()=>void}
/** Development-only browser integration checks. Exercises the real OrbitControls
 * listeners with synthetic mouse/touch events. Hardware touch still needs testing. */
export async function exerciseViewer({ camera, view, canvas, homeBounds, renderer, requestRender, scene }: Viewer, options: {sustained?:boolean;onProgress?:(progress:unknown)=>void} = {}) {
 const results: {name:string;passed:boolean;detail?:unknown}[]=[];
 const check=(name:string,passed:boolean,detail?:unknown)=>results.push({name,passed,detail});
 const next=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 const start=camera.position.clone();
 const target=view.controls.target.clone();
 view.controls.enableDamping=false;
 for(let angle=0;angle<Math.PI*2;angle+=.08)for(const polar of [view.controls.minPolarAngle,view.controls.maxPolarAngle]){
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(view.controls.minDistance,polar,angle)));
  view.controls.update();
  if(homeBounds.clone().expandByScalar(camera.near).containsPoint(camera.position))throw Error('Camera entered model');
  if(view.obstacles.some(obstacle=>obstacle.center.distanceTo(camera.position)<obstacle.radius+.3))throw Error('Camera entered tree canopy');
 }
 check('Full azimuth at both polar limits remains outside the expanded house bounds',true);
 check('Camera clearance includes both tree canopies',true);
 check('Camera remains above the display base',camera.position.y>homeBounds.min.y+1);
 view.reset();view.zoom(.0001);check('Zoom-in clamps to safe minimum',Math.abs(view.controls.getDistance()-view.controls.minDistance)<.001);
 view.zoom(10000);check('Zoom-out clamps to maximum',Math.abs(view.controls.getDistance()-view.controls.maxDistance)<.001);
 view.reset();check('Reset returns to starting pose',camera.position.distanceTo(start)<.001);
 const rect=canvas.getBoundingClientRect();const x=rect.width*.5,y=rect.height*.5;
 function pointer(type:string,id:number,px:number,py:number,pointerType='touch'){
  const event=new PointerEvent(type,{pointerId:id,pointerType,clientX:px,clientY:py,button:0,buttons:type==='pointerup'?0:1,bubbles:true});
  // Synthetic pointers do not have browser capture ownership. Only the harness
  // substitutes capture; production uses real pointer capture unchanged.
  canvas.dispatchEvent(event);
 }
 const capture=canvas.setPointerCapture.bind(canvas),release=canvas.releasePointerCapture.bind(canvas);
 canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
 try{
  pointer('pointerdown',7,x,y,'mouse');pointer('pointermove',7,x+100,y+20,'mouse');pointer('pointerup',7,x+100,y+20,'mouse');
  check('Mouse drag rotates camera',camera.position.distanceTo(start)>.1);
  view.reset();pointer('pointerdown',1,x-50,y);pointer('pointermove',1,x+30,y+10);pointer('pointerup',1,x+30,y+10);
  check('One-finger drag rotates',camera.position.distanceTo(start)>.1);
  view.reset();const before=view.controls.getDistance();
  pointer('pointerdown',1,x-60,y);pointer('pointerdown',2,x+60,y);pointer('pointermove',1,x-120,y);pointer('pointermove',2,x+120,y);
  pointer('pointerup',1,x-120,y);pointer('pointerup',2,x+120,y);
  check('Two-finger pinch zooms in',view.controls.getDistance()<before);
  check('Two-finger gesture cannot move target',view.controls.target.distanceTo(target)<.001);
  view.reset();canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-500,bubbles:true,cancelable:true}));
  check('Mouse wheel zooms',view.controls.getDistance()<before);
 }finally{canvas.setPointerCapture=capture;canvas.releasePointerCapture=release;}
 view.reset();
 const finishButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-finish] button')];
 const originalColors=new Map<THREE.MeshStandardMaterial,THREE.Color>();
 scene.traverse(node=>{if(node instanceof THREE.Mesh)for(const m of Array.isArray(node.material)?node.material:[node.material])if(m instanceof THREE.MeshStandardMaterial)originalColors.set(m,m.color.clone());});
 for(const button of finishButtons){button.click();if(button.getAttribute('aria-pressed')!=='true')throw Error('Finish selection did not update');}
 check('All finish options select successfully',finishButtons.length===34,{options:finishButtons.length});
 document.getElementById('reset-finishes')!.click();
 check('Reset finishes restores original material colors', [...originalColors].every(([m,c])=>m.color.equals(c)));
 check('Reset finishes restores original entry geometry',scene.getObjectByName('proposed-entry-door')?.visible===false&&scene.getObjectsByProperty('name','original-entry-door').every(n=>n.visible));
 check('Reset restores both original garage doors',scene.getObjectByName('proposed-garage-doors')?.visible===false&&scene.getObjectsByProperty('name','original-garage-doors').every(n=>n.visible));
 // Drive the real on-demand render loop once per animation frame. A direct
 // extra renderer.render() here would double the measured production workload.
 async function orbitFrame(theta:number,polar=1.2,radius=view.startDistance) {
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius,polar,theta)));
  view.controls.update();requestRender();await next();
 }
 const times:number[]=[];const route:{seconds:number;camera:number[];calls:number;triangles:number}[]=[];
 if(options.sustained){
  let begin=performance.now(),lastProgress=0;
  while(performance.now()-begin<30000){
   const t=(performance.now()-begin)/1000;
   await orbitFrame(.57+t*.13);
   if(t-lastProgress>1){lastProgress=t;options.onProgress?.({phase:'warmup',seconds:Math.round(t),requiredSeconds:30});}
  }
  begin=performance.now();let last=begin;lastProgress=-1;
  while(performance.now()-begin<120000){
   const t=(performance.now()-begin)/1000;
   await orbitFrame(.57+t*Math.PI*2/45,1.2+Math.sin(t/16)*.15,view.startDistance*(.92+.08*Math.sin(t/25)));
   const now=performance.now();times.push(now-last);last=now;
   if(t-lastProgress>1){
    lastProgress=t;route.push({seconds:t,camera:camera.position.toArray(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
    options.onProgress?.({phase:'measuring',seconds:Math.round(t),requiredSeconds:120,frames:times.length});
   }
  }
 }else{
  for(let i=0;i<60;i++)await orbitFrame(i*.012);
  let last=performance.now();
  for(let i=0;i<240;i++){await orbitFrame(i*.018);const now=performance.now();times.push(now-last);last=now;}
 }
 const sorted=[...times].sort((a,b)=>a-b);const avg=times.reduce((a,b)=>a+b,0)/times.length;
 const worst=sorted.slice(-Math.max(1,Math.ceil(times.length*.01)));
 check(options.sustained?'120-second orbit after 30-second warmup':'240-frame orbit measurement after 60-frame warmup',true,{frames:times.length,seconds:times.reduce((a,b)=>a+b,0)/1000,averageFPS:1000/avg,onePercentLowFPS:1000/(worst.reduce((a,b)=>a+b,0)/worst.length),p95Ms:sorted[Math.floor(times.length*.95)],p99Ms:sorted[Math.floor(times.length*.99)],stallsOver50Ms:times.filter(t=>t>50).length,rawMs:times,route});
 view.controls.enableDamping=true;view.reset();requestRender();
 await new Promise(resolve=>setTimeout(resolve,600));
 const idleFrame=renderer.info.render.frame;
 await new Promise(resolve=>setTimeout(resolve,600));
 check('Rendering stops while camera is still',renderer.info.render.frame===idleFrame,{framesDuringIdle:renderer.info.render.frame-idleFrame});
 check('Reset clears motion after interaction',camera.position.distanceTo(start)<.001);
 return {passed:results.every(r=>r.passed),results};
}
