import * as THREE from 'three';

/** Split a runtime surface without changing positions, UVs, normals, or its transform. */
export function extractTriangles(mesh: THREE.Mesh, offsets: number[], material: THREE.Material) {
  const source = mesh.geometry, index = source.index!;
  const selected = new Set(offsets), take: number[] = [], keep: number[] = [];
  for (let offset = 0; offset < index.count; offset += 3) {
    const destination = selected.has(offset) ? take : keep;
    destination.push(index.getX(offset), index.getX(offset + 1), index.getX(offset + 2));
  }
  if (!take.length) return undefined;
  const geometry = source.clone();
  geometry.setIndex(take); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const part = new THREE.Mesh(geometry, material);
  part.position.copy(mesh.position); part.quaternion.copy(mesh.quaternion); part.scale.copy(mesh.scale);
  part.castShadow = mesh.castShadow; part.receiveShadow = mesh.receiveShadow;
  mesh.parent!.add(part);
  const remainder = source.clone();
  remainder.setIndex(keep); remainder.computeBoundingBox(); remainder.computeBoundingSphere();
  mesh.geometry = remainder;
  return part;
}

/** Weld only for connectivity analysis; the render geometry retains its authored seams. */
export function connectedSurfaces(mesh: THREE.Mesh) {
  const positions = mesh.geometry.attributes.position, index = mesh.geometry.index!;
  const parent = Array.from({length: positions.count}, (_, i) => i);
  const vertices: THREE.Vector3[] = [], welded = new Map<string, number>();
  const root = (value: number): number => {
    while (parent[value] !== value) { parent[value] = parent[parent[value]]; value = parent[value]; }
    return value;
  };
  const join = (a: number, b: number) => { parent[root(a)] = root(b); };
  for (let i = 0; i < positions.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    vertices.push(point);
    const key = point.toArray().map(n => Math.round(n * 10000)).join(',');
    if (welded.has(key)) join(i, welded.get(key)!); else welded.set(key, i);
  }
  for (let offset = 0; offset < index.count; offset += 3) {
    join(index.getX(offset), index.getX(offset + 1)); join(index.getX(offset + 1), index.getX(offset + 2));
  }
  const groups = new Map<number, {bounds: THREE.Box3; offsets: number[]}>();
  for (let offset = 0; offset < index.count; offset += 3) {
    const key = root(index.getX(offset));
    if (!groups.has(key)) groups.set(key, {bounds: new THREE.Box3(), offsets: []});
    const group = groups.get(key)!;
    group.offsets.push(offset);
    for (let j = 0; j < 3; j++) group.bounds.expandByPoint(vertices[index.getX(offset + j)]);
  }
  return [...groups.values()];
}

export function triangleCenter(mesh: THREE.Mesh, offset: number, target = new THREE.Vector3()) {
  const geometry = mesh.geometry, point = new THREE.Vector3();
  target.set(0, 0, 0);
  for (let j = 0; j < 3; j++) target.add(point.fromBufferAttribute(geometry.attributes.position, geometry.index!.getX(offset + j)));
  return target.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
}
