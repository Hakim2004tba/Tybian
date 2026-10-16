// Run with: node --experimental-strip-types tests/promo.test.ts

import { applyPromo, type Coupon } from "../lib/promo/apply.ts";

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

const NOW = new Date("2026-06-15T12:00:00Z");
const base: Coupon = {
  id: "c1", code: "CLUB20", discount_type: "percentage", discount_value: 20,
  applicable_course_id: null, max_uses: null, uses_count: 0,
  starts_at: null, expires_at: null, is_active: 1,
};
const c = (over: Partial<Coupon> = {}): Coupon => ({ ...base, ...over });

// --- the discount itself ------------------------------------------------
check("20% off 1000 is 200", applyPromo(c(), 1000, null, NOW, false), { ok: true, discount: 200, finalAmount: 800 });
check("a fixed code takes its value",
  applyPromo(c({ discount_type: "fixed", discount_value: 500 }), 1200, null, NOW, false),
  { ok: true, discount: 500, finalAmount: 700 });

// Chargily takes whole dinars — a fractional discount would be refused.
check("a fractional percentage is rounded",
  applyPromo(c({ discount_value: 33 }), 1000, null, NOW, false),
  { ok: true, discount: 330, finalAmount: 670 });
check("33% of 1001 rounds, never trails",
  applyPromo(c({ discount_value: 33 }), 1001, null, NOW, false).ok &&
    Number.isInteger((applyPromo(c({ discount_value: 33 }), 1001, null, NOW, false) as { discount: number }).discount),
  true);

// A code bigger than the price must floor at zero, not pay the student.
check("a fixed code larger than the price floors at zero",
  applyPromo(c({ discount_type: "fixed", discount_value: 2000 }), 1500, null, NOW, false),
  { ok: true, discount: 1500, finalAmount: 0 });
check("100% is free, not negative",
  applyPromo(c({ discount_value: 100 }), 900, null, NOW, false),
  { ok: true, discount: 900, finalAmount: 0 });

// --- the gates ----------------------------------------------------------
check("an unknown code is refused", applyPromo(null, 1000, null, NOW, false), { ok: false, reason: "not_found" });
check("a disabled code is refused", applyPromo(c({ is_active: 0 }), 1000, null, NOW, false), { ok: false, reason: "inactive" });
check("a code that has not started is refused",
  applyPromo(c({ starts_at: "2026-07-01 00:00:00" }), 1000, null, NOW, false), { ok: false, reason: "not_started" });
check("an expired code is refused",
  applyPromo(c({ expires_at: "2026-06-01 00:00:00" }), 1000, null, NOW, false), { ok: false, reason: "expired" });
check("expiry is exclusive — at the exact instant it is over",
  applyPromo(c({ expires_at: "2026-06-15 12:00:00" }), 1000, null, NOW, false), { ok: false, reason: "expired" });
check("one second before expiry it still works",
  applyPromo(c({ expires_at: "2026-06-15 12:00:01" }), 1000, null, NOW, false).ok, true);
check("an exhausted code is refused",
  applyPromo(c({ max_uses: 50, uses_count: 50 }), 1000, null, NOW, false), { ok: false, reason: "exhausted" });
check("the last remaining use still works",
  applyPromo(c({ max_uses: 50, uses_count: 49 }), 1000, null, NOW, false).ok, true);
check("a second use by the same student is refused",
  applyPromo(c(), 1000, null, NOW, true), { ok: false, reason: "already_used" });
check("a course-specific code is refused elsewhere",
  applyPromo(c({ applicable_course_id: "course-a" }), 1000, "course-b", NOW, false), { ok: false, reason: "wrong_course" });
check("a course-specific code works on its own course",
  applyPromo(c({ applicable_course_id: "course-a" }), 1000, "course-a", NOW, false).ok, true);

// --- where the code may be spent ---------------------------------------
const COURSE = { kind: "course", id: "course-1" } as const;
const PACK = { kind: "pack", id: "pack-1" } as const;

/* A row written before 24-promo-scope.sql has no scope at all. It must
   keep working everywhere it used to — a code already on a flyer must
   not be narrowed by a migration. */
check(
  "a code with no scope still works on a course",
  applyPromo(c(), 1000, COURSE, NOW, false),
  { ok: true, discount: 200, finalAmount: 800 }
);
check(
  "a code with no scope still works on a pack",
  applyPromo(c(), 1000, PACK, NOW, false),
  { ok: true, discount: 200, finalAmount: 800 }
);

check(
  "a packs-only code is refused on a course",
  applyPromo(c({ scope: "packs" }), 1000, COURSE, NOW, false),
  { ok: false, reason: "wrong_scope" }
);
check(
  "a packs-only code works on any pack",
  applyPromo(c({ scope: "packs" }), 1000, PACK, NOW, false),
  { ok: true, discount: 200, finalAmount: 800 }
);
check(
  "a courses-only code is refused on a pack",
  applyPromo(c({ scope: "courses" }), 1000, PACK, NOW, false),
  { ok: false, reason: "wrong_scope" }
);

check(
  "a code tied to ONE pack is refused on another",
  applyPromo(c({ scope: "packs", applicable_pack_id: "pack-9" }), 1000, PACK, NOW, false),
  { ok: false, reason: "wrong_pack" }
);
check(
  "a code tied to ONE pack works on that pack",
  applyPromo(c({ scope: "packs", applicable_pack_id: "pack-1" }), 1000, PACK, NOW, false),
  { ok: true, discount: 200, finalAmount: 800 }
);

/* Issued for one course, so it cannot be spent on a bundle that
   happens to contain it — otherwise a course code quietly discounts a
   pack worth several times as much. */
check(
  "a course-specific code cannot be spent on a pack containing it",
  applyPromo(c({ applicable_course_id: "course-1" }), 1000, PACK, NOW, false),
  { ok: false, reason: "wrong_scope" }
);

/* Scope is checked before the id: a packs-only code with no pack named
   must still be refused on a course. */
check(
  "scope is enforced even when no specific target is named",
  applyPromo(c({ scope: "packs" }), 1000, { kind: "course", id: null }, NOW, false),
  { ok: false, reason: "wrong_scope" }
);

/* Expiry and exhaustion still come first — a dead code is dead
   wherever it is used. */
check(
  "an expired packs code is expired, not out-of-scope",
  applyPromo(
    c({ scope: "packs", expires_at: "2026-06-01 00:00:00" }),
    1000,
    COURSE,
    NOW,
    false
  ),
  { ok: false, reason: "expired" }
);

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exitCode = 1;
