/**
 * Pure study-tracking logic — no database, no `server-only`, so it is
 * directly unit-testable (tests/study-tracking.test.ts) and safe to
 * import from client components. Same split the rest of the project
 * uses: lib/study/* holds the decidable rules, lib/data/* the queries.
 */

/**
 * The seven marks a student keeps per lesson, mirroring the paper grid
 * they replace: three study passes (couches), three attempts at the
 * question bank (QCM), and a final revision.
 *
 * Order matters — it is the left-to-right order of the grid columns.
 */
export const STAGES = [
  "couche_1",
  "couche_2",
  "couche_3",
  "qcm_1",
  "qcm_2",
  "qcm_3",
  "revision",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  couche_1: "1ère couche",
  couche_2: "2ème couche",
  couche_3: "3ème couche",
  qcm_1: "QCM 1",
  qcm_2: "QCM 2",
  qcm_3: "QCM 3",
  revision: "Révision",
};

/**
 * Column groups for the header row. The three QCM marks sit under one
 * spanning "QCM" heading exactly as on the paper grid, so the header is
 * described here rather than hard-coded in the view — the table and its
 * heading can then never disagree about how many columns QCM covers.
 */
export const STAGE_GROUPS: { label: string; stages: Stage[] }[] = [
  { label: "1ère", stages: ["couche_1"] },
  { label: "2ème", stages: ["couche_2"] },
  { label: "3ème", stages: ["couche_3"] },
  { label: "QCM", stages: ["qcm_1", "qcm_2", "qcm_3"] },
  { label: "R", stages: ["revision"] },
];

export const EMPTY_PROGRESS: Record<Stage, boolean> = {
  couche_1: false,
  couche_2: false,
  couche_3: false,
  qcm_1: false,
  qcm_2: false,
  qcm_3: false,
  revision: false,
};

export type TrackedItem = { progress: Record<Stage, boolean> };

export type SubjectCompletion = {
  total: number;
  /** Lessons with all seven marks ticked. */
  done: number;
  inProgress: number;
  notStarted: number;
  /** Individual marks ticked across the subject. */
  ticks: number;
  /** Marks there are to tick: lessons x seven. */
  possible: number;
  pct: number;
};

/**
 * EVERY TICK COUNTS TOWARD THE PERCENTAGE.
 *
 * The percentage used to be finished-lessons over lessons, so a
 * student could read six lessons once each and still be shown 0%. That
 * is the number they look at to decide whether the work is going
 * anywhere, and a bar that will not move until seven boxes are ticked
 * reports nothing for most of the term. It is now ticked marks over
 * marks available, so the first box moves it.
 *
 * The trade this accepts, deliberately: one pass over every lesson now
 * reads as 14%, and 14% is not "nearly ready for the exam". `done`,
 * `inProgress` and `notStarted` still count whole lessons and are what
 * the page shows beside the bar, so the stricter reading stays
 * available next to the encouraging one.
 *
 * An empty subject reports 0%, not 100% — nothing has been done, and a
 * full bar on an empty syllabus would mislead both the student and the
 * admin monitoring view.
 */
export function computeSubjectCompletion(items: TrackedItem[]): SubjectCompletion {
  const total = items.length;
  const done = items.filter((i) => STAGES.every((st) => i.progress[st])).length;
  const started = items.filter((i) => STAGES.some((st) => i.progress[st])).length;

  const ticks = items.reduce(
    (sum, i) => sum + STAGES.filter((st) => i.progress[st]).length,
    0
  );
  const possible = total * STAGES.length;

  return {
    total,
    done,
    inProgress: started - done,
    notStarted: total - started,
    ticks,
    possible,
    pct: possible > 0 ? Math.round((ticks / possible) * 100) : 0,
  };
}

/** Guards a stage name arriving from a form before it is used as a
 *  COLUMN NAME in an upsert. */
export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

/** Whole days from today until the exam. Negative once it has passed,
 *  null when the student has not set a date. Pure so the countdown can
 *  be tested without freezing a clock in the UI. */
export function daysUntilExam(examDate: string | null, today: Date = new Date()): number | null {
  if (!examDate) return null;
  const exam = new Date(`${examDate}T00:00:00Z`);
  if (Number.isNaN(exam.getTime())) return null;
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((exam.getTime() - start) / 86_400_000);
}
