/**
 * Promo-code rules. Pure and dependency-free so they can be tested
 * without a database (tests/promo.test.ts) — this decides what a
 * student pays, which puts it in the same category as the Chargily
 * amount conversion that once billed a hundredfold.
 */

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  /**
   * Where the code is accepted.
   *   all     — anything
   *   courses — single courses only
   *   packs   — packs only
   * Absent on a row written before 24-promo-scope.sql, which is read
   * as "all": that is what those codes did, and a migration must not
   * silently narrow a code already printed on a flyer.
   */
  scope?: "all" | "courses" | "packs" | null;
  /** NULL means the code works on any course. */
  applicable_course_id: string | null;
  /** NULL means any pack (within `scope`). */
  applicable_pack_id?: string | null;
  max_uses: number | null;
  uses_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: number;
};

export type Rejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "wrong_course"
  | "wrong_pack"
  | "wrong_scope"
  | "already_used";

export type PromoOutcome =
  | { ok: true; discount: number; finalAmount: number }
  | { ok: false; reason: Rejection };

/** What the code is being used against. */
export type PromoTarget =
  | { kind: "course"; id: string | null }
  | { kind: "pack"; id: string | null };

/**
 * Whether a code may be used, and what it takes off.
 *
 * `now` and `alreadyUsedByThisUser` are arguments rather than things
 * this function looks up: a rule that reads the clock or the database
 * itself cannot be tested at a boundary, and "expires at midnight" is
 * exactly the kind of rule that needs testing at its boundary.
 *
 * `target` accepts a bare course id for the callers written before
 * packs could take a promo at all, so adding the scope did not have to
 * touch the course checkout.
 */
export function applyPromo(
  coupon: Coupon | null,
  amount: number,
  target: PromoTarget | string | null,
  now: Date,
  alreadyUsedByThisUser: boolean
): PromoOutcome {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (coupon.is_active !== 1) return { ok: false, reason: "inactive" };

  if (coupon.starts_at && now < new Date(`${coupon.starts_at.replace(" ", "T")}Z`)) {
    return { ok: false, reason: "not_started" };
  }
  if (coupon.expires_at && now >= new Date(`${coupon.expires_at.replace(" ", "T")}Z`)) {
    return { ok: false, reason: "expired" };
  }

  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return { ok: false, reason: "exhausted" };
  }

  /*
    One use per student. A club code meant to give each member a
    discount would otherwise let one member buy the whole catalogue with
    it — the per-code cap counts uses, not people.
  */
  if (alreadyUsedByThisUser) return { ok: false, reason: "already_used" };

  const where: PromoTarget =
    target === null || typeof target === "string"
      ? { kind: "course", id: target }
      : target;

  /*
    SCOPE FIRST, then the specific id. A code limited to packs must be
    refused on a course even when no particular pack was named — the
    two columns answer different questions, and checking only the id
    would let a "packs only" code through on every course.
  */
  const scope = coupon.scope ?? "all";
  if (scope === "courses" && where.kind !== "course") {
    return { ok: false, reason: "wrong_scope" };
  }
  if (scope === "packs" && where.kind !== "pack") {
    return { ok: false, reason: "wrong_scope" };
  }

  if (where.kind === "course") {
    if (coupon.applicable_course_id && coupon.applicable_course_id !== where.id) {
      return { ok: false, reason: "wrong_course" };
    }
  } else {
    if (coupon.applicable_pack_id && coupon.applicable_pack_id !== where.id) {
      return { ok: false, reason: "wrong_pack" };
    }
    /* A code tied to one COURSE cannot be spent on a pack, even a pack
       that happens to contain it: it was issued for that course. */
    if (coupon.applicable_course_id) {
      return { ok: false, reason: "wrong_scope" };
    }
  }

  const raw =
    coupon.discount_type === "percentage"
      ? (amount * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);

  /*
    Rounded to whole dinars and never more than the price.

    Chargily takes whole dinars (see lib/payment/chargily-logic.ts), so
    a 33% discount on 1000 must not produce 333.33 and a payment the
    gateway refuses. And a 2000-dinar fixed code on a 1500-dinar course
    must floor at zero rather than hand the student 500 back.
  */
  const discount = Math.min(Math.round(raw), Math.round(amount));

  return { ok: true, discount, finalAmount: Math.round(amount) - discount };
}

/** A refusal the student can act on, rather than "invalid code". */
export function promoMessage(reason: string): string {
  switch (reason) {
    case "not_found": return "رمز الخصم غير صحيح";
    case "inactive": return "هذا الرمز غير مفعّل";
    case "not_started": return "لم يبدأ العمل بهذا الرمز بعد";
    case "expired": return "انتهت صلاحية هذا الرمز";
    case "exhausted": return "استُنفد عدد مرات استعمال هذا الرمز";
    case "already_used": return "استعملت هذا الرمز من قبل";
    case "wrong_course": return "هذا الرمز لا ينطبق على هذه الدورة";
    case "wrong_pack": return "هذا الرمز لا ينطبق على هذه الباقة";
    case "wrong_scope": return "هذا الرمز لا يُستعمل هنا";
    default: return "تعذّر تطبيق رمز الخصم";
  }
}
