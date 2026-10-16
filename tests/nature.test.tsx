import { expect, test } from "vitest";
import sharp from "sharp";
import {
  NatureSimulation,
  RIPPLE_COUNT,
  RIPPLE_LIFETIME,
} from "../src/nature/simulation";
import {
  insidePolygon,
  POOL,
  coverTransform,
  imagePoint,
} from "../src/nature/geometry";

test("pool hits exclude the stone wall, coping, terrace, and residence", () => {
  expect(insidePolygon([0.8, 0.8], POOL)).toBe(true);
  for (const point of [
    [0.8, 0.9],
    [0.8, 0.7],
    [0.65, 0.6],
    [0.5, 0.65],
  ] as const)
    expect(insidePolygon(point, POOL)).toBe(false);
});
test("natural ripples are present at startup and continue with no pointer input", () => {
  const simulation = new NatureSimulation(42);
  expect(simulation.ripples.length).toBeGreaterThan(0);
  const initial = simulation.ripples.map((r) => r.born);
  for (let frame = 0; frame < 600; frame++) {
    simulation.advance(1 / 30);
    expect(simulation.ripples.length).toBeGreaterThan(0);
    expect(simulation.ripples.length).toBeLessThanOrEqual(RIPPLE_COUNT);
    expect(
      simulation.ripples.every((r) => insidePolygon([r.x, r.y], POOL)),
    ).toBe(true);
  }
  expect(simulation.ripples.every((r) => !initial.includes(r.born))).toBe(true);
  expect(
    simulation.ripples.every((r) => simulation.time - r.born < RIPPLE_LIFETIME),
  ).toBe(true);
});
test("wind varies smoothly and remains stable across uneven frame times", () => {
  const simulation = new NatureSimulation(19);
  const values: number[] = [];
  for (let frame = 0; frame < 600; frame++) {
    const before = simulation.wind;
    simulation.advance(frame % 20 === 0 ? 0.12 : 1 / 30);
    expect(Number.isFinite(simulation.wind)).toBe(true);
    expect(Math.abs(simulation.wind - before)).toBeLessThan(0.1);
    expect(simulation.wind).toBeGreaterThan(0.05);
    expect(simulation.wind).toBeLessThan(1.15);
    values.push(simulation.wind);
  }
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.2);
});
test("pointer contact creates a localized ripple which decays after departure", () => {
  const simulation = new NatureSimulation(3);
  simulation.advance(0.2);
  simulation.disturb([0.8, 0.8]);
  const contact = simulation.ripples.find((r) => r.x === 0.8 && r.y === 0.8);
  expect(contact).toBeDefined();
  expect(contact!.strength).toBeGreaterThanOrEqual(2.8);
  expect(contact!.strength).toBeGreaterThan(
    3 *
      Math.max(
        ...simulation.ripples
          .filter((r) => r !== contact)
          .map((r) => r.strength),
      ),
  );
  expect(simulation.pointerForce).toBeGreaterThan(0);
  simulation.leave();
  simulation.advance(6);
  expect(simulation.ripples).not.toContain(contact);
  expect(simulation.pointerForce).toBeLessThan(0.0001);
});
test("pointer movement on the residence never creates a water ripple", () => {
  const simulation = new NatureSimulation(2);
  const before = simulation.ripples.length;
  simulation.disturb([0.7, 0.4]);
  expect(simulation.ripples).toHaveLength(before);
});
test("pointer coordinates map to the same scene in portrait and landscape crops", () => {
  for (const size of [
    [390, 844],
    [844, 390],
    [1366, 768],
  ] as const) {
    const transform = coverTransform(size[0], size[1], 1672, 941, 0.65);
    const center = imagePoint([0.5, 0.5], transform);
    expect(center[0]).toBeCloseTo(transform.offset[0] + transform.scale[0] / 2);
    expect(center[1]).toBeCloseTo(0.5);
    expect(transform.scale.every((value) => value > 0 && value <= 1)).toBe(
      true,
    );
  }
});
test("published motion matte protects concrete corners and rocks, and includes foreground shrubs", async () => {
  const { data, info } = await sharp("public/images/nature-mask.webp")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [
    ...data.subarray(
      (y * info.width + x) * info.channels,
      (y * info.width + x) * info.channels + 3,
    ),
  ];
  expect(pixel(1300, 750)[0]).toBeGreaterThan(240);
  for (const [x, y] of [
    [1300, 860],
    [1000, 650],
    [1100, 400],
    [800, 310],
  ])
    expect(pixel(x, y)).toEqual([0, 0, 0]);
  // Scan whole patches, including the corner missed by the original spot checks.
  for (const [left, top, width, height] of [
    [512, 667, 40, 35], // exposed terrace corner
    [703, 743, 30, 15], // pool's front-left concrete corner
    [685, 800, 40, 40], // central boulder
    [330, 780, 30, 35], // left boulder
    [380, 861, 45, 25], // flat foreground rock
  ])
    for (let y = top; y < top + height; y++)
      for (let x = left; x < left + width; x++) {
        expect(pixel(x, y)).toEqual([0, 0, 0]);
        // A translated leaf can never override this destination protection.
        expect(data[(y * info.width + x) * info.channels + 3]).toBe(128);
      }
  for (const [x, y] of [
    [90, 900],
    [220, 880],
    [570, 830],
    [800, 900],
    [960, 880],
    [1260, 930],
    [1450, 900],
    [1600, 900],
  ])
    expect(pixel(x, y)[1]).toBeGreaterThan(90);
});

test("fast cursor strokes add stronger bounded impulses while ambient ripples stay gentle", () => {
  const simulation = new NatureSimulation(42);
  simulation.advance(0.2);
  simulation.disturb([0.75, 0.78]);
  simulation.advance(0.15);
  simulation.disturb([0.9, 0.8]);
  const stroke = simulation.ripples.at(-1)!;
  expect(stroke.strength).toBeGreaterThan(3.8);
  expect(stroke.strength).toBeLessThanOrEqual(4.6);
  simulation.advance(6);
  expect(simulation.ripples.every((r) => r.strength <= 0.85)).toBe(true);
});

test("ambient branch springs move independently with bounded, continuous recoil", () => {
  const simulation = new NatureSimulation(42);
  const ranges = [[], [], []] as number[][];
  for (let frame = 0; frame < 1800; frame++) {
    const previous = [...simulation.sway];
    simulation.advance(frame % 75 === 0 ? 0.1 : 1 / 30);
    simulation.sway.forEach((value, index) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThan(1.6);
      expect(Math.abs(value - previous[index])).toBeLessThan(0.13);
      ranges[index].push(value);
    });
  }
  ranges.forEach((values) =>
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5),
  );
  expect(ranges[0]).not.toEqual(ranges[1]);
  expect(simulation.pointerForce).toBe(0);
});
