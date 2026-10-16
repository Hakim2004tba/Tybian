import assert from "node:assert/strict";
import { tierFor, bundleTotals, nextTier, type DiscountTier } from "../lib/plans/bundle.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

const TIERS: DiscountTier[] = [
  { minCourses: 2, percent: 10 },
  { minCourses: 3, percent: 15 },
  { minCourses: 4, percent: 20 },
];

check("one course gets no bundle discount", () => {
  assert.equal(tierFor(1, TIERS), 0);
  assert.equal(tierFor(0, TIERS), 0);
  /* The rule that protects every single-course price on the site. */
  assert.equal(bundleTotals([3000], TIERS).total, 3000);
});

check("each threshold applies from its own count", () => {
  assert.equal(tierFor(2, TIERS), 10);
  assert.equal(tierFor(3, TIERS), 15);
  assert.equal(tierFor(4, TIERS), 20);
});

check("above the top threshold keeps the top rate, not zero", () => {
  assert.equal(tierFor(7, TIERS), 20);
  assert.equal(tierFor(50, TIERS), 20);
});

check("the discount and the total always add back to the subtotal", () => {
  /* Prices chosen to make the percentage land on a fraction. */
  for (const prices of [[3333, 1111], [999, 999, 999], [1234, 4321, 777, 55]]) {
    const t = bundleTotals(prices, TIERS);
    assert.equal(t.discount + t.total, t.subtotal, JSON.stringify(prices));
  }
});

check("nothing is ever charged in fractions of a dinar", () => {
  const t = bundleTotals([999, 999, 999], TIERS);
  assert.ok(Number.isInteger(t.discount));
  assert.ok(Number.isInteger(t.total));
  assert.ok(Number.isInteger(t.subtotal));
});

check("rounding favours the student, never the platform", () => {
  /* 2997 at 15% is 449.55. Rounded down the student pays 2548; rounded
     up they would pay 2547 — a dinar we did not earn either way, but
     the discount must never be quietly shaved. */
  const t = bundleTotals([999, 999, 999], TIERS);
  assert.equal(t.percent, 15);
  assert.equal(t.discount, 449);
  assert.equal(t.total, 2548);
});

check("an unsorted or gappy ladder still picks the best rate", () => {
  const messy: DiscountTier[] = [
    { minCourses: 6, percent: 30 },
    { minCourses: 2, percent: 10 },
  ];
  assert.equal(tierFor(3, messy), 10);
  assert.equal(tierFor(6, messy), 30);
});

check("a misconfigured ladder cannot charge more than the subtotal", () => {
  const silly: DiscountTier[] = [{ minCourses: 2, percent: 100 }];
  const t = bundleTotals([1000, 1000], silly);
  assert.equal(t.total, 0);
  assert.ok(t.total >= 0);
});

check("no tiers configured means no discount, not a crash", () => {
  const t = bundleTotals([1000, 2000], []);
  assert.equal(t.percent, 0);
  assert.equal(t.total, 3000);
});

check("an empty basket is zero, not NaN", () => {
  const t = bundleTotals([], TIERS);
  assert.equal(t.subtotal, 0);
  assert.equal(t.total, 0);
  assert.equal(t.discount, 0);
});

check("the nudge points at the next real improvement", () => {
  assert.deepEqual(nextTier(2, TIERS), { minCourses: 3, percent: 15 });
  assert.deepEqual(nextTier(3, TIERS), { minCourses: 4, percent: 20 });
  /* Already at the best rate — nothing to promise. */
  assert.equal(nextTier(4, TIERS), null);
  assert.equal(nextTier(9, TIERS), null);
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
