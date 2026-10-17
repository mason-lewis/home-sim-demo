import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {connectedSurfaces, extractTriangles, triangleCenter} from './geometry';

export type EntryStyle = 'source' | 'full' | 'three-quarter' | 'half' | 'none';
export type GarageStyle = 'source' | 'flush' | 'horizontal' | 'carriage' | 'glass';
const entryBounds = new THREE.Box3(new THREE.Vector3(2.65, -.01, -4.06), new THREE.Vector3(3.88, 2.14, -4));
export const garageOpenings = [
  {left: 5.3725, right: 8.1657, bottom: -.3048, top: 2.1336, z: -.928},
  {left: 8.7253, right: 11.5185, bottom: -.3048, top: 2.1336, z: -.928},
];
const inGarage = (point: THREE.Vector3) => garageOpenings.some(d => point.x >= d.left - .035 && point.x <= d.right + .035 && point.y >= d.bottom - .04 && point.y <= d.top + .04 && Math.abs(point.z - d.z) < .07);

export function installDoors(house: THREE.Group, scene: THREE.Scene) {
  house.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  house.traverse(node => { if (node instanceof THREE.Mesh && !Array.isArray(node.material)) meshes.push(node); });
  const source = meshes.find(mesh => (mesh.material as THREE.Material).name === 'joinery')!.material as THREE.MeshStandardMaterial;
  const paint = source.clone(); paint.name = 'all-door-paint';
  const originalMap = source.map;
  const glass = new THREE.MeshPhysicalMaterial({color: '#f2f5ed', roughness: .13, transmission: .86, thickness: .04, ior: 1.5, envMapIntensity: .8});
  glass.name = 'garage-door-glass';
  const metal = new THREE.MeshStandardMaterial({color: '#363b38', metalness: .72, roughness: .3});
  const entryOriginal: THREE.Mesh[] = [], garageOriginal: THREE.Mesh[] = [], colored: THREE.Mesh[] = [];
  let doorMembers = 0;
  for (const mesh of meshes) {
    const material = mesh.material as THREE.Material;
    if (['black', 'glass', 'viewer-thin-glass'].includes(material.name)) {
      const offsets: number[] = [];
      for (let offset = 0; offset < mesh.geometry.index!.count; offset += 3) if (inGarage(triangleCenter(mesh, offset))) offsets.push(offset);
      const part = extractTriangles(mesh, offsets, material.name.includes('glass') ? material : paint);
      if (part) { part.name = 'original-garage-doors'; garageOriginal.push(part); if (!material.name.includes('glass')) colored.push(part); }
    }
    if (['joinery', 'glass', 'viewer-thin-glass'].includes(material.name)) {
      const offsets: number[] = [];
      for (let offset = 0; offset < mesh.geometry.index!.count; offset += 3) if (entryBounds.containsPoint(triangleCenter(mesh, offset))) offsets.push(offset);
      const part = extractTriangles(mesh, offsets, material.name === 'joinery' ? paint : material);
      if (part) { part.name = 'original-entry-door'; entryOriginal.push(part); if (material.name === 'joinery') colored.push(part); }
    }
    if (!['joinery', 'black'].includes(material.name) || !mesh.geometry.index!.count) continue;
    const offsets = connectedSurfaces(mesh).filter(group => {
      const size = group.bounds.getSize(new THREE.Vector3());
      // The reviewed export uses 108-face bevelled door members; window frames
      // have 44 faces. Bounds exclude rails and the long horizontal trim.
      return group.offsets.length === 108 && Math.min(size.x, size.z) < .12 && Math.max(size.x, size.z) < 2.5;
    }).flatMap(group => group.offsets);
    doorMembers += offsets.length / 108;
    const part = extractTriangles(mesh, offsets, paint);
    if (part) { part.name = 'paintable-house-doors'; colored.push(part); }
  }
  // Procedural replacement panels have local UVs, independent of the source AO atlas.
  const newPaint = paint.clone(); newPaint.name = 'new-door-paint'; newPaint.aoMap = null;
  const entry = new THREE.Group(); entry.name = 'proposed-entry-door'; scene.add(entry);
  const garages = new THREE.Group(); garages.name = 'proposed-garage-doors'; scene.add(garages);
  const addBox = (group: THREE.Group, w: number, h: number, depth: number, x: number, y: number, z: number, material: THREE.Material = newPaint) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 2, Math.min(.008, depth*.22, w*.1, h*.1)), material);
    mesh.position.set(x, y, z); mesh.castShadow = material !== glass; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  };
  const clear = (group: THREE.Group) => { for (const node of [...group.children]) { group.remove(node); if (node instanceof THREE.Mesh) node.geometry.dispose(); } };
  function color(value: string, hex: string) {
    for (const material of [paint, newPaint]) {
      material.map = value === 'natural' ? originalMap : null;
      material.color.set(value === 'natural' && originalMap ? '#ffffff' : hex);
      material.roughness = value === 'natural' ? .58 : .4;
      material.metalness = 0; material.needsUpdate = true;
    }
  }
  function entryStyle(style: EntryStyle) {
    entryOriginal.forEach(part => { part.visible = style === 'source'; });
    clear(entry); entry.visible = style !== 'source';
    if (style === 'source') return;
    const w = 1.2192, h = 2.1336, x = 3.2639, z = -4.03225, border = .12;
    const fraction = {full: 1, 'three-quarter': .75, half: .5, none: 0}[style];
    const glazing = (h - .3) * fraction, solid = h - .15 - glazing;
    addBox(entry, border, h, .045, x - w/2 + border/2, h/2, z);
    addBox(entry, border, h, .045, x + w/2 - border/2, h/2, z);
    addBox(entry, w - 2*border, .15, .045, x, h - .075, z);
    if (solid) addBox(entry, w - 2*border, solid, .045, x, solid/2, z);
    if (glazing) addBox(entry, w - 2*border, glazing, .018, x, solid + glazing/2, z, glass);
    addBox(entry, .035, .25, .07, x + w/2 - .11, .98, z + .04, metal);
  }
  function garageStyle(style: GarageStyle) {
    garageOriginal.forEach(part => { part.visible = style === 'source'; });
    clear(garages); garages.visible = style !== 'source';
    if (style === 'source') return;
    for (const opening of garageOpenings) {
      const w = opening.right - opening.left, h = opening.top - opening.bottom;
      const x = (opening.left + opening.right)/2, y = (opening.top + opening.bottom)/2, z = opening.z;
      const gap = .008, rows = style === 'flush' ? 1 : 4, rowHeight = h / rows;
      if (style === 'glass') {
        const frame = .055;
        addBox(garages, frame, h, .055, opening.left + frame/2, y, z);
        addBox(garages, frame, h, .055, opening.right - frame/2, y, z);
        for (let row = 0; row < 4; row++) {
          const middle = opening.bottom + (row + .5)*rowHeight;
          addBox(garages, w - frame*2, rowHeight - frame, .018, x, middle, z - .012, glass);
          addBox(garages, w - frame*2, frame, .055, x, opening.bottom + row*rowHeight + frame/2, z);
        }
        addBox(garages, w, frame, .055, x, opening.top - frame/2, z);
        addBox(garages, frame, h, .055, x, y, z);
      } else {
        for (let row = 0; row < rows; row++) {
          const middle = opening.bottom + (row + .5)*rowHeight;
          addBox(garages, w - gap, rowHeight - gap, .05, x, middle, z);
          if (style === 'horizontal' || style === 'carriage') {
            const columns = style === 'carriage' ? 2 : 3;
            for (let column = 0; column < columns; column++) {
              const panelW = (w - .2)/columns, panelX = opening.left + .1 + (column + .5)*panelW;
              addBox(garages, panelW - .07, rowHeight - .12, .015, panelX, middle, z + .032);
            }
          }
        }
        if (style === 'carriage') {
          addBox(garages, .035, .32, .04, x - .12, y, z + .065, metal);
          addBox(garages, .035, .32, .04, x + .12, y, z + .065, metal);
          for (const side of [-1, 1]) for (const dy of [-.65, .65]) addBox(garages, .28, .035, .025, x + side*(w/2 - .2), y + dy, z + .06, metal);
        }
      }
    }
  }
  entryStyle('source'); garageStyle('source');
  return {color, entryStyle, garageStyle, paint, newPaint, glass, metal, colored, entry, garages,
    entryOriginal, garageOriginal, doorMembers, garageCount: garageOpenings.length};
}
