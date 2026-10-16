import { test } from "node:test";
import assert from "node:assert/strict";
import { getAtmosphere, CYCLE_DURATION } from "./lighting.ts";
test("opens at dusk, holds, then blends gradually to night", () => {
  assert.equal(getAtmosphere(0).lighting, "dusk");
  assert.equal(getAtmosphere(14_999).weights.night, 0);
  assert.equal(getAtmosphere(37_500).weights.night, 0.5);
  assert.equal(getAtmosphere(60_000).lighting, "night");
});
test("cycles continuously through all four scenes", () => {
  assert.equal(getAtmosphere(120_000).lighting, "morning");
  assert.equal(getAtmosphere(180_000).lighting, "day");
  assert.equal(getAtmosphere(CYCLE_DURATION).lighting, "dusk");
  assert.deepEqual(
    getAtmosphere(CYCLE_DURATION * 8 + 37_500),
    getAtmosphere(37_500),
  );
  assert.deepEqual(getAtmosphere(-100), getAtmosphere(0));
});
test("always has an opaque base and valid incoming opacity", () => {
  for (let time = 0; time <= CYCLE_DURATION; time += 250) {
    const weights = Object.values(getAtmosphere(time).weights);
    assert.equal(weights.filter((value) => value === 1).length, 1);
    assert.ok(weights.every((value) => value >= 0 && value <= 1));
  }
});
