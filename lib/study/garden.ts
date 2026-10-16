/**
 * "ازرع مستقبلك" — the study garden.
 *
 * Every two hours of study lights one tree in the student's own plot.
 * A plot holds 20 trees; filling it does not end the month, it ENLARGES
 * the plot — the ground gains another row and there is more to light.
 *
 * WHY THIS AND NOT A RANKING ALONE: a bare leaderboard rewards the top
 * three and tells everyone else a position they cannot realistically
 * move — demotivating exactly the students who most need to keep going.
 * The plot is always advanceable: the next tree is a fixed distance
 * away, never "overtake three people".
 *
 * WHY IT RESETS MONTHLY, not weekly: a week is too short for a medical
 * student's rhythm — a fortnight on a module then a lull around exams
 * is normal, and a weekly reset keeps wiping the evidence of it. A
 * month is long enough to show a real habit and short enough that a bad
 * start is never permanent.
 *
 * Pure and dependency-free, so the arithmetic that decides what a
 * student sees is directly testable (tests/study-garden.test.ts).
 */

/** Study time that lights one tree. */
export const MINUTES_PER_TREE = 120;

/** Trees on the starting plot. */
export const PLOT_SIZE = 20;

export type Garden = {
  /** Trees lit this month. Never capped — the plot grows instead. */
  lit: number;
  /** Trees on the plot right now, always a whole number of plots. */
  capacity: number;
  /** Still dark on the current plot. */
  remaining: number;
  /** How many times the plot has been filled and extended. */
  expansions: number;
  minutes: number;
  /** Minutes still needed to light the next tree. */
  minutesToNextTree: number;
  /** 0..1 toward the next tree, for the progress bar. */
  fractionToNextTree: number;
};

export function gardenFromSeconds(monthlySeconds: number): Garden {
  const minutes = Math.max(0, Math.floor(monthlySeconds / 60));
  const lit = Math.floor(minutes / MINUTES_PER_TREE);

  /*
    The plot grows by a whole plot at a time. A student who has lit 20
    trees sees 40 spaces with 20 of them alight — the reward for filling
    the ground is more ground, which is the one thing a finished
    progress bar can never offer.
  */
  const expansions = Math.floor(lit / PLOT_SIZE);
  const capacity = PLOT_SIZE * (expansions + 1);

  const intoTree = minutes % MINUTES_PER_TREE;

  return {
    lit,
    capacity,
    remaining: capacity - lit,
    expansions,
    minutes,
    minutesToNextTree: MINUTES_PER_TREE - intoTree,
    fractionToNextTree: intoTree / MINUTES_PER_TREE,
  };
}

/** Trees a peer has grown — the leaderboard shows this beside their hours. */
export function treesFromSeconds(monthlySeconds: number): number {
  return Math.floor(Math.max(0, Math.floor(monthlySeconds / 60)) / MINUTES_PER_TREE);
}

/**
 * The first day of the month a given date belongs to, as YYYY-MM-DD.
 *
 * Built from the calendar month rather than "thirty days back" so every
 * student in a cohort is measured over exactly the same days — a
 * rolling window would rank them against different periods.
 */
export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}
