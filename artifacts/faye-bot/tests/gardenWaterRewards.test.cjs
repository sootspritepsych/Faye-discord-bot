const { test } = require("node:test");
const assert = require("node:assert/strict");
const { gardenWaterReward } = require("../src/lib/gardenWaterRewards.ts");

test("tending your own plant gives one point with no social bonus", () => {
  assert.deepEqual(gardenWaterReward(true, false), { points: 1, firstHelpBonus: 0 });
  assert.deepEqual(gardenWaterReward(true, true), { points: 1, firstHelpBonus: 0 });
});
test("helping each new friend for the first time today gives five points total", () => {
  assert.deepEqual(gardenWaterReward(false, false), { points: 5, firstHelpBonus: 2 });
});
test("later watering for the same friend today gives three points total", () => {
  assert.deepEqual(gardenWaterReward(false, true), { points: 3, firstHelpBonus: 0 });
});
