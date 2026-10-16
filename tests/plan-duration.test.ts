import assert from "node:assert/strict";
import { describeDuration, expiryFor, parseDuration } from "../lib/plans/duration.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

/* ---- labels ---- */
check("lifetime reads as lifetime", () => {
  assert.equal(describeDuration(null, "ar"), "مدى الحياة");
  assert.equal(describeDuration(null, "en"), "Lifetime");
});

check("whole months are shown as months, not days", () => {
  assert.equal(describeDuration(90, "ar"), "3 أشهر");
  assert.equal(describeDuration(90, "en"), "3 months");
  assert.equal(describeDuration(180, "en"), "6 months");
});

check("Arabic singular and dual are not pluralised", () => {
  assert.equal(describeDuration(30, "ar"), "شهر واحد");
  assert.equal(describeDuration(60, "ar"), "شهران");
  assert.equal(describeDuration(1, "ar"), "يوم واحد");
  assert.equal(describeDuration(2, "ar"), "يومان");
});

check("Arabic plural switches shape above ten", () => {
  assert.equal(describeDuration(330, "ar"), "11 شهراً");
  assert.equal(describeDuration(45, "ar"), "45 يوماً");
});

check("years win over months when both divide", () => {
  assert.equal(describeDuration(365, "ar"), "سنة كاملة");
  assert.equal(describeDuration(730, "en"), "2 years");
});

check("a duration that is neither falls back to days", () => {
  assert.equal(describeDuration(7, "en"), "7 days");
});

/* ---- expiry ---- */
check("lifetime never expires", () => {
  assert.equal(expiryFor(null, new Date("2026-01-01T00:00:00Z")), null);
});

check("expiry is the purchase moment plus the days", () => {
  const now = new Date("2026-01-01T10:00:00Z");
  assert.equal(expiryFor(90, now)!.toISOString(), "2026-04-01T10:00:00.000Z");
});

/* ---- parsing ---- */
check("an empty box means lifetime", () => {
  assert.deepEqual(parseDuration(""), { ok: true, days: null });
  assert.deepEqual(parseDuration(null), { ok: true, days: null });
});

check("a plain number of days is accepted", () => {
  assert.deepEqual(parseDuration("180"), { ok: true, days: 180 });
});

check("zero, negative, fractional and absurd durations are refused", () => {
  for (const bad of ["0", "-1", "1.5", "4000", "abc"]) {
    assert.deepEqual(parseDuration(bad), { ok: false }, `should refuse ${bad}`);
  }
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
