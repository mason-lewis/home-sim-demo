import { Box3, MathUtils, PerspectiveCamera, Sphere, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export const START_AZIMUTH = .57;
export const START_ELEVATION = .29;
/** Fixed target, no panning, and a conservative sphere keep every orbit outside
 * the house. The near plane stays at least one meter clear of its bounding box. */
export function createHomeCamera(camera: PerspectiveCamera, canvas: HTMLCanvasElement, bounds: Box3) {
  const sphere = bounds.getBoundingSphere(new Sphere());
  const target = sphere.center.clone();
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan = false;
  controls.zoomToCursor = false;
  controls.enableDamping = true;
  controls.dampingFactor = .12;
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .8;
  controls.minPolarAngle = .22;
  controls.maxPolarAngle = Math.PI / 2 + .22;
  controls.minDistance = sphere.radius + 1.2;
  let startDistance = 0;
  let obstacles: Sphere[] = [];
  let correcting = false;
  function protectCamera() {
    if (correcting) return;
    const offset = camera.position.clone().sub(target);
    const direction = offset.clone().normalize();
    let radius = offset.length();
    for (const obstacle of obstacles) {
      const delta = obstacle.center.clone().sub(target);
      const along = delta.dot(direction);
      const perpendicularSq = delta.lengthSq() - along * along;
      const clearance = obstacle.radius + .35;
      if (along <= 0 || perpendicularSq >= clearance * clearance) continue;
      radius = Math.max(radius, along + Math.sqrt(clearance * clearance - perpendicularSq));
    }
    const protectedPosition=target.clone().addScaledVector(direction,radius);
    protectedPosition.y=Math.max(protectedPosition.y,bounds.min.y+1.6);
    // A low photographic view still stays above grade and outside tree crowns.
    // Resolve canopy clearance horizontally after clamping the eye height.
    for(let pass=0;pass<2;pass++)for(const obstacle of obstacles){
      const clearance=obstacle.radius+.35,dy=protectedPosition.y-obstacle.center.y;
      if(Math.abs(dy)>=clearance)continue;
      const delta=new Vector3().subVectors(protectedPosition,obstacle.center);delta.y=0;
      const required=Math.sqrt(clearance*clearance-dy*dy);
      if(delta.length()<required){
        if(delta.lengthSq()<.0001)delta.set(0,0,1);
        delta.setLength(required);protectedPosition.x=obstacle.center.x+delta.x;protectedPosition.z=obstacle.center.z+delta.z;
      }
    }
    if (camera.position.distanceToSquared(protectedPosition) > .00000001) {
      correcting = true;
      camera.position.copy(protectedPosition);
      controls.update();
      correcting = false;
    }
  }
  controls.addEventListener('change', protectCamera);
  function setObstacles(spheres: Sphere[]) { obstacles = spheres; protectCamera(); }

  function fitDistance() {
    const vertical = MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    return sphere.radius / Math.sin(Math.min(vertical, horizontal)) * 1.08;
  }
  function resize() {
    const previous = startDistance;
    startDistance = fitDistance();
    controls.maxDistance = startDistance * 1.45;
    if (previous) {
      const offset = camera.position.clone().sub(target);
      offset.setLength(MathUtils.clamp(offset.length() * startDistance / previous, controls.minDistance, controls.maxDistance));
      camera.position.copy(target).add(offset);
      controls.update();
    }
  }
  function reset() {
    controls.reset();
    controls.target.copy(target);
    camera.position.copy(target).add(new Vector3(
      Math.sin(START_AZIMUTH) * Math.cos(START_ELEVATION), Math.sin(START_ELEVATION),
      Math.cos(START_AZIMUTH) * Math.cos(START_ELEVATION),
    ).multiplyScalar(startDistance));
    camera.lookAt(target);
    controls.update();
    controls.saveState();
  }
  resize(); reset();
  function zoom(factor: number) {
    const offset = camera.position.clone().sub(target);
    offset.setLength(MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(target).add(offset);
    controls.update();
  }
  return { controls, target, sphere, resize, reset, zoom, setObstacles, get obstacles() { return obstacles; }, get startDistance() { return startDistance; } };
}
