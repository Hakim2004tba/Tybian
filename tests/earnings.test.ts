import assert from "node:assert/strict";
import { splitAmount, teacherCut } from "../lib/plans/earnings.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

check("a single-course sale goes entirely to its teacher", () => {
  const m = splitAmount(3000, [{ key: "t1", weight: 3000 }]);
  assert.equal(m.get("t1"), 3000);
});

check("a shared sale splits by list price, not by headcount", () => {
  /* 4000 paid for a 5000 + 1000 basket: the bigger course earns more. */
  const m = splitAmount(4000, [
    { key: "t1", weight: 5000 },
    { key: "t2", weight: 1000 },
  ]);
  assert.equal(m.get("t1"), 3333 + 1); // 3333 plus the remainder
  assert.equal(m.get("t2"), 666);
  assert.equal(sum(m), 4000);
});

check("the split ALWAYS adds back to the amount paid", () => {
  const cases: [number, number[]][] = [
    [4000, [5000, 1000]],
    [999, [333, 333, 333]],
    [1, [10, 10, 10]],
    [7777, [1234, 4321, 999, 55]],
    [10000, [1, 1, 1, 1, 1, 1, 1]],
  ];
  for (const [amount, weights] of cases) {
    const m = splitAmount(amount, weights.map((w, i) => ({ key: `t${i}`, weight: w })));
    assert.equal(sum(m), amount, `${amount} over ${weights.join("+")}`);
  }
});

check("two courses by the SAME teacher add up on one row", () => {
  const m = splitAmount(3000, [
    { key: "t1", weight: 1000 },
    { key: "t1", weight: 2000 },
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get("t1"), 3000);
});

check("free courses bundled together still account for the money", () => {
  const m = splitAmount(1000, [
    { key: "t1", weight: 0 },
    { key: "t2", weight: 0 },
  ]);
  assert.equal(sum(m), 1000);
});

check("nothing to split is not a crash", () => {
  assert.equal(splitAmount(5000, []).size, 0);
  assert.equal(sum(splitAmount(0, [{ key: "t1", weight: 100 }])), 0);
});

check("the teacher's cut is a percentage of what was actually received", () => {
  assert.equal(teacherCut(10000, 60), 6000);
  assert.equal(teacherCut(3333, 50), 1666);
});

check("no share agreed means nothing owed, not everything", () => {
  /* The default is 0 on purpose — see migration 20. */
  assert.equal(teacherCut(10000, 0), 0);
});

check("the platform can never owe more than it took", () => {
  assert.equal(teacherCut(5000, 100), 5000);
  assert.equal(teacherCut(5000, 150), 5000);
  for (const pct of [0, 1, 33.3, 62.5, 99, 100]) {
    assert.ok(teacherCut(4321, pct) <= 4321, String(pct));
  }
});

check("payouts are whole dinars, rounded in the platform's favour", () => {
  /* 62.5% of 999 is 624.375 — never 624.4, never 625. */
  assert.equal(teacherCut(999, 62.5), 624);
  assert.ok(Number.isInteger(teacherCut(999, 62.5)));
});

check("negative or nonsense input earns nothing", () => {
  assert.equal(teacherCut(-100, 50), 0);
  assert.equal(teacherCut(1000, -5), 0);
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
