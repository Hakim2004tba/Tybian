/**
 * What a teacher earned, and how a shared payment is divided.
 *
 * Two things make this less obvious than "sum the payments":
 *
 *   FREE ACCESS IS NOT INCOME. An admin grant and a 100%-discount
 *   coupon both produce an enrolment and no payment, so counting
 *   enrolments would pay teachers for students who paid nothing.
 *   Only successful payments count, and only the amount actually
 *   received after any discount.
 *
 *   ONE PAYMENT CAN BELONG TO SEVERAL TEACHERS. A pack or a
 *   self-assembled basket is a single payment covering several
 *   courses, which may have different teachers. The amount is split
 *   between them IN PROPORTION TO THE LIST PRICES of the courses it
 *   covered — the same ratio the student was quoted — so a 5000 DA
 *   course earns its teacher more of a discounted basket than a 1000
 *   DA one does.
 *
 * Pure and dependency-free, because this decides what people are paid.
 * Every rule is a test in tests/earnings.test.ts.
 */

export type Share = {
  /** Anything identifying the recipient — a teacher id here. */
  key: string;
  /** The list price of that recipient's part of the sale. */
  weight: number;
};

/**
 * Splits `amount` between `shares`, in proportion to their weights,
 * in whole dinars that always add back to `amount`.
 *
 * THE REMAINDER GOES TO THE LARGEST SHARE. Proportional division of
 * whole units almost never comes out even; dropping the remainder
 * loses money from the books and spreading it invents fractions. Giving
 * it to the biggest contributor is arbitrary but it is CONSISTENT, and
 * consistency is what makes the totals reconcile.
 */
export function splitAmount(amount: number, shares: Share[]): Map<string, number> {
  const result = new Map<string, number>();
  if (shares.length === 0) return result;

  const total = shares.reduce((sum, s) => sum + s.weight, 0);

  /* Every weight zero — free courses bundled together, say. Falling
     back to an equal split keeps the money accounted for instead of
     dividing by zero. */
  if (total <= 0) {
    const each = Math.floor(amount / shares.length);
    for (const share of shares) {
      result.set(share.key, (result.get(share.key) ?? 0) + each);
    }
    const spread = each * shares.length;
    const first = shares[0].key;
    result.set(first, (result.get(first) ?? 0) + (amount - spread));
    return result;
  }

  let assigned = 0;
  for (const share of shares) {
    const part = Math.floor((amount * share.weight) / total);
    result.set(share.key, (result.get(share.key) ?? 0) + part);
    assigned += part;
  }

  /* The rounding remainder, to the heaviest share. */
  const remainder = amount - assigned;
  if (remainder !== 0) {
    const heaviest = shares.reduce((a, b) => (b.weight > a.weight ? b : a));
    result.set(heaviest.key, (result.get(heaviest.key) ?? 0) + remainder);
  }

  return result;
}

/**
 * The teacher's cut of what their courses sold for.
 *
 * Rounded DOWN: the platform may not pay out more than it took, and a
 * fraction of a dinar cannot be transferred anyway.
 */
export function teacherCut(grossSales: number, percent: number): number {
  if (!(percent > 0) || !(grossSales > 0)) return 0;
  const capped = Math.min(100, percent);
  return Math.floor((grossSales * capped) / 100);
}
