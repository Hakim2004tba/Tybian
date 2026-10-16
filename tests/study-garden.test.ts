import assert from "node:assert/strict";
import {
  gardenFromSeconds, treesFromSeconds, monthStart, MINUTES_PER_TREE, PLOT_SIZE,
} from "../lib/study/garden.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

const hours = (h: number) => h * 3600;

check("a fresh month is a dark plot of twenty", () => {
  const g = gardenFromSeconds(0);
  assert.equal(g.lit, 0);
  assert.equal(g.capacity, PLOT_SIZE);
  assert.equal(g.remaining, PLOT_SIZE);
  assert.equal(g.expansions, 0);
});

check("two hours lights exactly one tree, and not a minute sooner", () => {
  assert.equal(gardenFromSeconds(hours(2) - 60).lit, 0);
  assert.equal(gardenFromSeconds(hours(2)).lit, 1);
  assert.equal(gardenFromSeconds(hours(4)).lit, 2);
});

check("the bar fills across the two hours and resets at each tree", () => {
  assert.equal(gardenFromSeconds(0).fractionToNextTree, 0);
  assert.equal(gardenFromSeconds(hours(1)).fractionToNextTree, 0.5);
  assert.equal(gardenFromSeconds(hours(2)).fractionToNextTree, 0);
  assert.equal(gardenFromSeconds(hours(3)).fractionToNextTree, 0.5);
});

check("minutes to the next tree counts down and never reads zero", () => {
  assert.equal(gardenFromSeconds(0).minutesToNextTree, MINUTES_PER_TREE);
  assert.equal(gardenFromSeconds(hours(1)).minutesToNextTree, 60);
  /* At exactly one tree the NEXT one is a full two hours away, not 0 —
     a "0 minutes to go" that never completes is the bug this guards. */
  assert.equal(gardenFromSeconds(hours(2)).minutesToNextTree, MINUTES_PER_TREE);
});

check("filling the plot enlarges it rather than capping", () => {
  const full = gardenFromSeconds(hours(2 * PLOT_SIZE));
  assert.equal(full.lit, PLOT_SIZE);
  assert.equal(full.capacity, PLOT_SIZE * 2);
  assert.equal(full.expansions, 1);
  assert.equal(full.remaining, PLOT_SIZE);
});

check("remaining is never negative, however long the month", () => {
  for (const h of [0, 5, 39, 40, 41, 80, 81, 200]) {
    const g = gardenFromSeconds(hours(h));
    assert.ok(g.remaining >= 0, `${h}h gave ${g.remaining}`);
    assert.ok(g.lit <= g.capacity, `${h}h lit ${g.lit} of ${g.capacity}`);
  }
});

check("nonsense input cannot produce a broken plot", () => {
  const g = gardenFromSeconds(-9999);
  assert.equal(g.lit, 0);
  assert.equal(g.capacity, PLOT_SIZE);
});

check("a peer's tree count matches their own plot", () => {
  for (const h of [0, 2, 7, 40]) {
    assert.equal(treesFromSeconds(hours(h)), gardenFromSeconds(hours(h)).lit);
  }
});

check("the month starts on the first, whatever day it is", () => {
  assert.equal(monthStart("2026-09-26"), "2026-09-01");
  assert.equal(monthStart("2026-01-01"), "2026-01-01");
  assert.equal(monthStart("2026-12-31"), "2026-12-01");
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
