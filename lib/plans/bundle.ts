/**
 * Buying several courses at once.
 *
 * A pack is built in advance for a whole semester or year. This is the
 * other case: the student picks the courses THEY want and the discount
 * follows how many they picked, so we do not have to invent a pack for
 * every possible combination — and there is a combination for every
 * subset of the catalogue.
 *
 * Pure and dependency-free, because this decides what somebody is
 * charged. Every rule below is a test in tests/bundle.test.ts.
 */

export type DiscountTier = {
  /** This tier applies from this many courses upward. */
  minCourses: number;
  /** Whole percent: 10 means 10%. */
  percent: number;
};

export type BundleTotals = {
  count: number;
  /** Sum of the courses' own prices, before any discount. */
  subtotal: number;
  percent: number;
  /** Whole dinars taken off. */
  discount: number;
  /** What the student pays. */
  total: number;
};

/**
 * The tier that applies to `count` courses — the highest threshold at
 * or below it, so a 5-course basket gets the "4 or more" rate rather
 * than nothing.
 *
 * Returns 0 for a single course: there is no bundle, so there is no
 * bundle discount. Anything else would quietly undercut the normal
 * price of every course on the site.
 */
export function tierFor(count: number, tiers: DiscountTier[]): number {
  if (count < 2) return 0;

  let best = 0;
  for (const tier of tiers) {
    if (tier.minCourses <= count && tier.percent > best) best = tier.percent;
  }
  return best;
}

/**
 * What the basket costs.
 *
 * ROUNDING IS DELIBERATE AND ONE-WAY: the discount is rounded DOWN and
 * the total is whatever remains, so the two always add back to the
 * subtotal exactly. Rounding the total instead lets it drift a dinar
 * from `subtotal - discount`, and a checkout page whose numbers do not
 * add up is a checkout page nobody trusts.
 *
 * Whole dinars throughout, because that is all Chargily accepts — see
 * lib/payment/chargily-logic.ts.
 */
export function bundleTotals(prices: number[], tiers: DiscountTier[]): BundleTotals {
  const count = prices.length;
  const subtotal = Math.round(prices.reduce((sum, p) => sum + p, 0));
  const percent = tierFor(count, tiers);
  const discount = Math.floor((subtotal * percent) / 100);

  return { count, subtotal, percent, discount, total: subtotal - discount };
}

/**
 * The next tier worth reaching, for the "add one more and save 15%"
 * nudge. Null when the basket is already at the best rate.
 */
export function nextTier(count: number, tiers: DiscountTier[]): DiscountTier | null {
  const current = tierFor(count, tiers);
  const ahead = tiers
    .filter((t) => t.minCourses > count && t.percent > current)
    .sort((a, b) => a.minCourses - b.minCourses);
  return ahead[0] ?? null;
}
