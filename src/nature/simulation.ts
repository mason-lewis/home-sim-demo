import { insidePolygon, POOL, type Point } from "./geometry";
export const RIPPLE_LIFETIME = 5;
export const RIPPLE_COUNT = 12;
const BRANCH_FREQUENCIES = [1.7, 2.4, 2.0];
const BRANCH_DAMPING = [0.46, 0.58, 0.5];
export interface Ripple {
  x: number;
  y: number;
  born: number;
  strength: number;
}
function randomGenerator(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
/** Ambient events and damped wind evolve independently of pointer activity. */
export class NatureSimulation {
  time = 0;
  wind = 0.3;
  velocity = 0;
  // Canopy, flexible shrub stems, and secondary branches have different inertia.
  sway = [0.2, 0.15, 0.25];
  private swayVelocity = [0, 0, 0];
  pointer: Point = [-2, -2];
  pointerForce = 0;
  ripples: Ripple[] = [];
  private random: () => number;
  private targetWind = 0.45;
  private nextGust = 1;
  private nextRipple = 0;
  private lastPointer: Point | null = null;
  private lastPointerTime = -1;
  private lastInteractionRipple = -1;
  constructor(seed = Math.floor(Math.random() * 0xffffffff)) {
    this.random = randomGenerator(seed);
    // Seed an already-active surface, rather than waiting for the first event.
    for (let i = 0; i < 5; i++) this.ambientRipple(-this.random() * 3);
  }
  private ambientRipple(born: number) {
    let point: Point;
    do {
      point = [0.48 + this.random() * 0.48, 0.73 + this.random() * 0.13];
    } while (!insidePolygon(point, POOL));
    this.addRipple(point, born, 0.45 + this.random() * 0.4);
  }
  private addRipple(point: Point, born: number, strength: number) {
    this.ripples.push({ x: point[0], y: point[1], born, strength });
    if (this.ripples.length > RIPPLE_COUNT) this.ripples.shift();
  }
  advance(dt: number) {
    // Integrate with bounded steps for stable springs after slow frames.
    const steps = Math.max(1, Math.ceil(dt / 0.025));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.time += step;
      if (this.time >= this.nextGust) {
        this.targetWind = 0.2 + this.random() * 0.8;
        this.nextGust = this.time + 1.4 + this.random() * 3;
      }
      this.velocity +=
        ((this.targetWind - this.wind) * 2.8 - this.velocity * 2.2) * step;
      this.wind += this.velocity * step;
      for (let branch = 0; branch < 3; branch++) {
        const frequency = BRANCH_FREQUENCIES[branch];
        const damping = BRANCH_DAMPING[branch];
        const force =
          (this.wind - 0.35) * 1.35 +
          0.12 +
          0.26 * Math.sin(this.time * (0.85 + branch * 0.19) + branch * 1.9) +
          0.15 * Math.sin(this.time * (1.35 + branch * 0.23) + 0.6 + branch);
        const acceleration =
          (force - this.sway[branch]) * frequency * frequency -
          2 * damping * frequency * this.swayVelocity[branch];
        this.swayVelocity[branch] += acceleration * step;
        this.sway[branch] += this.swayVelocity[branch] * step;
      }
      this.pointerForce *= Math.exp(-step * 2.8);
      if (this.time >= this.nextRipple) {
        this.ambientRipple(this.time);
        this.nextRipple = this.time + 0.65 + this.random() * 1.15;
      }
    }
    this.ripples = this.ripples.filter(
      (ripple) => this.time - ripple.born < RIPPLE_LIFETIME,
    );
  }
  disturb(point: Point) {
    const dt = Math.max(0.016, this.time - this.lastPointerTime);
    const distance = this.lastPointer
      ? Math.hypot(
          point[0] - this.lastPointer[0],
          point[1] - this.lastPointer[1],
        )
      : 0.012;
    this.pointer = point;
    this.pointerForce = Math.min(
      1,
      this.pointerForce + Math.min(distance / dt, 2) * 0.32,
    );
    if (
      insidePolygon(point, POOL) &&
      distance > 0.001 &&
      this.time - this.lastInteractionRipple > 0.12
    ) {
      // A pointer stroke displaces substantially more water than a wind ripple.
      // Velocity adds energy without making a fast pass unbounded.
      this.addRipple(
        point,
        this.time,
        2.8 + Math.min(distance / dt, 1.5) * 1.2,
      );
      this.lastInteractionRipple = this.time;
    }
    this.lastPointer = point;
    this.lastPointerTime = this.time;
  }
  leave() {
    this.lastPointer = null;
  }
  rippleUniforms() {
    const data = new Float32Array(RIPPLE_COUNT * 4);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = this.ripples[i];
      data.set(
        ripple
          ? [ripple.x, ripple.y, ripple.born, ripple.strength]
          : [0, 0, -100, 0],
        i * 4,
      );
    }
    return data;
  }
}
