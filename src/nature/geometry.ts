export type Point = readonly [number, number];
// The visible pool surface, inset from its coping and vertical stone wall.
// Coordinates refer to the original 1672 × 941 photograph.
export const POOL: Point[] = [
  [752 / 1672, 741 / 941],
  [1214 / 1672, 689 / 941],
  [1648 / 1672, 718 / 941],
  [1648 / 1672, 822 / 941],
  [752 / 1672, 756 / 941],
];
export function insidePolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function coverTransform(
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
  positionX = 0.5,
) {
  const cover = Math.max(width / imageWidth, height / imageHeight);
  const scale: Point = [
    width / (imageWidth * cover),
    height / (imageHeight * cover),
  ];
  return {
    scale,
    offset: [(1 - scale[0]) * positionX, (1 - scale[1]) * 0.5] as Point,
  };
}
export function imagePoint(
  point: Point,
  transform: ReturnType<typeof coverTransform>,
): Point {
  return [
    point[0] * transform.scale[0] + transform.offset[0],
    point[1] * transform.scale[1] + transform.offset[1],
  ];
}
