import assert from "node:assert/strict";
import { fitScaleFor, FIT_GUTTER, MIN_FIT, MAX_FIT } from "../lib/library/fit.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

/* A4 at 72dpi, which is what pdf.js reports for scale 1. */
const A4 = 595;
/* A 4:3 slide, the other thing the library is full of. */
const SLIDE = 960;

const fits = (host: number, base: number) => {
  const scale = fitScaleFor(host, base);
  assert.notEqual(scale, null, "expected a scale");
  return base * (scale as number) <= host;
};

check("a page never comes out wider than the column it is in", () => {
  for (const host of [320, 375, 414, 768, 1024, 1280, 1600]) {
    for (const base of [A4, SLIDE]) {
      assert.ok(fits(host, base), `${base}pt page overflows a ${host}px column`);
    }
  }
});

check("the column the docked assistant leaves still fits the page", () => {
  /* 1440 desktop, minus the 380px panel and the student rail. */
  const narrowed = 1440 - 380 - 240;
  assert.ok(fits(narrowed, SLIDE));
  assert.ok(fits(narrowed, A4));
});

check("narrowing the column never widens the page", () => {
  const wide = fitScaleFor(1200, A4) as number;
  const narrow = fitScaleFor(700, A4) as number;
  assert.ok(narrow <= wide);
});

check("a gutter is left on both sides", () => {
  const host = 800;
  const scale = fitScaleFor(host, A4) as number;
  assert.equal(host - A4 * scale, FIT_GUTTER);
});

check("an unmeasured element fits to nothing rather than to zero", () => {
  assert.equal(fitScaleFor(0, A4), null);
  assert.equal(fitScaleFor(800, 0), null);
  assert.equal(fitScaleFor(FIT_GUTTER, A4), null);
  assert.equal(fitScaleFor(-10, A4), null);
});

check("a short page is not blown up past the maximum", () => {
  assert.equal(fitScaleFor(4000, 200), MAX_FIT);
});

check("a huge page is not shrunk past the minimum", () => {
  assert.equal(fitScaleFor(100, 100000), MIN_FIT);
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
