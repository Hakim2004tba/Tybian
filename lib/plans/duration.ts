/**
 * How long a subscription lasts, and how to say it.
 *
 * Pure: no database, no `server-only`, so the checkout action, the
 * pricing panel and the tests all read the SAME rule. The duration used
 * to be a constant in lib/actions/checkout.ts (`THREE_MONTH_DAYS = 90`)
 * and the label a fixed string in the dictionary, which meant the two
 * could disagree — and that selling a six-month plan required editing
 * and redeploying the platform.
 *
 * `null` days means lifetime. Not `0`, and not a very large number:
 * "no expiry" is a different thing from "a long expiry", and
 * enrollments.expires_at is NULL for exactly this case.
 */
export type PlanDuration = number | null;

/** Whole months when the number of days divides cleanly, else days. */
export function describeDuration(
  days: PlanDuration,
  locale: "ar" | "en"
): string {
  if (days === null) return locale === "ar" ? "مدى الحياة" : "Lifetime";

  const ar = locale === "ar";

  if (days % 365 === 0) {
    const years = days / 365;
    if (ar) return years === 1 ? "سنة كاملة" : `${years} سنوات`;
    return years === 1 ? "1 year" : `${years} years`;
  }

  if (days % 30 === 0) {
    const months = days / 30;
    if (ar) {
      /*
        Arabic counts in three shapes, not two: one month, two months,
        then a plural for 3–10. "1 أشهر" and "2 أشهر" are both wrong,
        and a subscription label is not the place to be visibly careless
        with the reader's language.
      */
      if (months === 1) return "شهر واحد";
      if (months === 2) return "شهران";
      if (months <= 10) return `${months} أشهر`;
      return `${months} شهراً`;
    }
    return months === 1 ? "1 month" : `${months} months`;
  }

  if (ar) {
    if (days === 1) return "يوم واحد";
    if (days === 2) return "يومان";
    if (days <= 10) return `${days} أيّام`;
    return `${days} يوماً`;
  }
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * The moment a plan bought now expires.
 *
 * Takes `now` rather than reading the clock, so the boundary is
 * testable and so a single purchase cannot land two enrollments a
 * millisecond apart on different days.
 */
export function expiryFor(days: PlanDuration, now: Date): Date | null {
  if (days === null) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Reads a duration out of an admin form.
 *
 * An empty box means lifetime — that is what the "مدى الحياة" checkbox
 * posts. Anything else must be a whole number of days between 1 and ten
 * years; a plan of 0 days would sell access that has already expired.
 */
export function parseDuration(raw: string | null | undefined): { ok: true; days: PlanDuration } | { ok: false } {
  const value = String(raw ?? "").trim();
  if (value === "" || value.toLowerCase() === "lifetime") return { ok: true, days: null };

  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 3650) return { ok: false };
  return { ok: true, days: n };
}
