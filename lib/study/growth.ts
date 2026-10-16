/**
 * The growth model behind the study leaderboard.
 *
 * WHY A GARDEN AND NOT JUST A RANKED LIST: a bare ranking rewards only
 * the top three, and for everyone else it reports a position they cannot
 * realistically change that week — which is demotivating precisely for
 * the students who most need to keep going. Medical students also study
 * in cohorts, so the model deliberately has two layers:
 *
 *   1. Each student grows their OWN tree from their own study minutes.
 *      Progress is always visible and always achievable: the next stage
 *      is a fixed number of minutes away, not "overtake three peers".
 *   2. The cohort's minutes add up to a SHARED garden. That turns
 *      classmates into collaborators as well as rivals, which matches
 *      how a promo actually revises.
 *
 * Thresholds are weekly, so the tree resets each week and nobody is
 * permanently ahead by virtue of having started earlier — every week is
 * a fresh, winnable one.
 *
 * Pure and dependency-free so it is directly unit-testable
 * (tests/study-growth.test.ts).
 */

export type GrowthStageKey = "seed" | "sprout" | "sapling" | "tree" | "blossom";

export type GrowthStage = {
  key: GrowthStageKey;
  /** Minutes of study in the current week required to reach this stage. */
  minMinutes: number;
};

export const GROWTH_STAGES: GrowthStage[] = [
  /* The stage's NAME lives in the dictionary (dash.garden.stageNames),
     keyed by `key`, so the ladder reads in either language. Only the
     threshold belongs here. */
  { key: "seed", minMinutes: 0 },
  { key: "sprout", minMinutes: 30 },
  { key: "sapling", minMinutes: 120 },
  { key: "tree", minMinutes: 300 },
  { key: "blossom", minMinutes: 600 },
];

export type GrowthState = {
  stage: GrowthStage;
  stageIndex: number;
  minutes: number;
  /** Minutes still needed for the next stage; null at the final stage. */
  minutesToNext: number | null;
  nextStage: GrowthStage | null;
  /** 0..1 progress through the CURRENT stage, for the progress ring. */
  fractionToNext: number;
};

export function growthFromSeconds(weeklySeconds: number): GrowthState {
  const minutes = Math.max(0, Math.floor(weeklySeconds / 60));

  let stageIndex = 0;
  for (let i = GROWTH_STAGES.length - 1; i >= 0; i--) {
    if (minutes >= GROWTH_STAGES[i].minMinutes) {
      stageIndex = i;
      break;
    }
  }

  const stage = GROWTH_STAGES[stageIndex];
  const nextStage = GROWTH_STAGES[stageIndex + 1] ?? null;

  if (!nextStage) {
    return { stage, stageIndex, minutes, minutesToNext: null, nextStage: null, fractionToNext: 1 };
  }

  const span = nextStage.minMinutes - stage.minMinutes;
  const done = minutes - stage.minMinutes;

  return {
    stage,
    stageIndex,
    minutes,
    minutesToNext: nextStage.minMinutes - minutes,
    nextStage,
    // span is never 0 given the table above, but guard anyway rather
    // than risk a NaN width reaching the DOM.
    fractionToNext: span > 0 ? Math.min(1, Math.max(0, done / span)) : 1,
  };
}

export type CohortGarden = {
  totalMinutes: number;
  contributors: number;
  /** How many fully-grown trees the cohort's combined effort represents.
   *  One tree per `MINUTES_PER_COHORT_TREE` minutes. */
  trees: number;
  /** 0..1 toward the next shared tree, for the progress bar. */
  fractionToNextTree: number;
};

export const MINUTES_PER_COHORT_TREE = 600;

/**
 * The shared total. Counts only students who actually studied this week
 * — padding it with zero-contributors would make a quiet week look the
 * same as a busy one.
 */
export function cohortGarden(weeklySecondsPerStudent: number[]): CohortGarden {
  const contributors = weeklySecondsPerStudent.filter((s) => s > 0).length;
  const totalMinutes = weeklySecondsPerStudent.reduce((sum, s) => sum + Math.floor(s / 60), 0);
  const trees = Math.floor(totalMinutes / MINUTES_PER_COHORT_TREE);
  const remainder = totalMinutes % MINUTES_PER_COHORT_TREE;

  return {
    totalMinutes,
    contributors,
    trees,
    fractionToNextTree: remainder / MINUTES_PER_COHORT_TREE,
  };
}

/** "3س 20د" from raw seconds — shared by every surface that shows study
 *  time so the formatting cannot drift between them. */
export function formatStudyTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}
