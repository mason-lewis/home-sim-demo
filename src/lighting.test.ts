import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAtmosphere,
  CYCLE_DURATION,
  SCENE_DURATION,
  HOLD_DURATION,
} from "./lighting.ts";
test("begins changing after three seconds and reaches the next scene at twenty", () => {
  assert.equal(HOLD_DURATION, 3_000);
  assert.equal(SCENE_DURATION, 20_000);
  assert.equal(getAtmosphere(2_999).blend, 0);
  assert.equal(getAtmosphere(11_500).blend, 0.5);
  assert.equal(getAtmosphere(20_000).lighting, "night");
});
test("completes all four scenes in eighty seconds without a seam", () => {
  assert.equal(CYCLE_DURATION, 80_000);
  assert.equal(getAtmosphere(40_000).lighting, "morning");
  assert.equal(getAtmosphere(60_000).lighting, "day");
  assert.deepEqual(
    getAtmosphere(CYCLE_DURATION * 5 + 11_500),
    getAtmosphere(11_500),
  );
  assert.deepEqual(getAtmosphere(-100), getAtmosphere(0));
});
test("each blend has one opaque base and a bounded incoming image", () => {
  for (let time = 0; time <= CYCLE_DURATION; time += 125) {
    const frame = getAtmosphere(time);
    const weights = Object.values(frame.weights);
    assert.equal(weights.filter((value) => value === 1).length, 1);
    assert.ok(weights.every((value) => value >= 0 && value <= 1));
    assert.equal(frame.weights[frame.current], 1);
    assert.equal(frame.weights[frame.next], frame.blend);
  }
});
