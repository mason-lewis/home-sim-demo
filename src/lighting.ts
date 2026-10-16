export type Lighting = "morning" | "day" | "dusk" | "night";
export const lightingLabels: Record<Lighting, string> = {
  morning: "Morning light",
  day: "In daylight",
  dusk: "At dusk",
  night: "After dark",
};
export const cycleOrder: Lighting[] = ["dusk", "night", "morning", "day"];
export const SCENE_DURATION = 20_000;
export const HOLD_DURATION = 3_000;
export const CYCLE_DURATION = SCENE_DURATION * cycleOrder.length;
export interface Atmosphere {
  weights: Record<Lighting, number>;
  current: Lighting;
  next: Lighting;
  blend: number;
  lighting: Lighting;
}
export function getAtmosphere(elapsed: number): Atmosphere {
  const time = Math.max(0, elapsed) % CYCLE_DURATION;
  const index = Math.floor(time / SCENE_DURATION);
  const progress = Math.max(
    0,
    ((time % SCENE_DURATION) - HOLD_DURATION) /
      (SCENE_DURATION - HOLD_DURATION),
  );
  const blend = progress * progress * (3 - 2 * progress);
  const current = cycleOrder[index],
    next = cycleOrder[(index + 1) % cycleOrder.length];
  const weights = { morning: 0, day: 0, dusk: 0, night: 0 };
  weights[current] = 1;
  weights[next] = blend;
  // Give each visible layer its own opacity; incoming is composited over current.
  return {
    weights,
    current,
    next,
    blend,
    lighting: blend < 0.5 ? current : next,
  };
}
