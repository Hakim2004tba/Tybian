/**
 * The zoom at which a page of `baseWidth` fits a column of `hostWidth`.
 *
 * Its own module so it can be tested: this one expression is what
 * decides whether a lesson opens readable or overflowing, and it is
 * asked the same question from three directions — first paint, a
 * rotation, and the reader losing width to the docked assistant.
 *
 * Returns null when either measurement is missing, which means "not
 * laid out yet, do not fit to nothing".
 */
export const FIT_GUTTER = 24;
/*
  NOT 0.5. A lower bound of 0.5 was the real cause of "every lesson
  opens enormous on my phone": a 960pt slide fitted to a 375px screen
  needs 0.37, the floor pushed it back up to 0.5, and the page came out
  480px wide on a 375px screen — permanently overflowing, with the
  right-hand side of every slide off the edge.

  A minimum exists only to keep a pathological measurement from
  producing a zero-width page. Fitting is what this function is for,
  and nothing here may override it.
*/
export const MIN_FIT = 0.05;
export const MAX_FIT = 2;

export function fitScaleFor(hostWidth: number, baseWidth: number): number | null {
  if (!(baseWidth > 0) || !(hostWidth > 0)) return null;
  const available = hostWidth - FIT_GUTTER;
  if (available <= 0) return null;
  return Math.min(MAX_FIT, Math.max(MIN_FIT, available / baseWidth));
}
