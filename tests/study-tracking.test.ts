// Run with: node --experimental-strip-types tests/study-tracking.test.ts

import {
  computeSubjectCompletion,
  daysUntilExam,
  isStage,
  STAGES,
  STAGE_GROUPS,
  type Stage,
} from "../lib/study/tracking.ts";
import { canAccessPath } from "../lib/auth/route-access.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

function item(...on: Stage[]) {
  return { progress: Object.fromEntries(STAGES.map((s) => [s, on.includes(s)])) as Record<Stage, boolean> };
}

// --- the grid shape matches the paper form -----------------------------
check("seven marks per lesson", STAGES.length, 7);
check("QCM spans three columns", STAGE_GROUPS.find((g) => g.label === "QCM")?.stages.length, 3);
check(
  "column order is 1ère, 2ème, 3ème, QCM, R",
  STAGE_GROUPS.map((g) => g.label),
  ["1ère", "2ème", "3ème", "QCM", "R"]
);
check(
  "groups cover every stage exactly once",
  STAGE_GROUPS.flatMap((g) => g.stages),
  [...STAGES]
);

// --- completion --------------------------------------------------------
check("empty subject is 0%, not 100%", computeSubjectCompletion([]), {
  total: 0, done: 0, inProgress: 0, notStarted: 0, ticks: 0, possible: 0, pct: 0,
});

check("done only when ALL seven are ticked", computeSubjectCompletion([item(...STAGES)]), {
  total: 1, done: 1, inProgress: 0, notStarted: 0, ticks: 7, possible: 7, pct: 100,
});

/* The rule this file exists to pin down: the bar moves on the FIRST
   tick. It used to stay at 0 until all seven were made, which reported
   nothing for most of a term. */
check("one tick already moves the percentage", computeSubjectCompletion([item("couche_1")]), {
  total: 1, done: 0, inProgress: 1, notStarted: 0, ticks: 1, possible: 7, pct: 14,
});

check(
  "six of seven is in-progress, not done, but shows most of the bar",
  computeSubjectCompletion([item("couche_1", "couche_2", "couche_3", "qcm_1", "qcm_2", "qcm_3")]),
  { total: 1, done: 0, inProgress: 1, notStarted: 0, ticks: 6, possible: 7, pct: 86 }
);

check("untouched lessons are notStarted", computeSubjectCompletion([item(), item(), item()]), {
  total: 3, done: 0, inProgress: 0, notStarted: 3, ticks: 0, possible: 21, pct: 0,
});

check(
  "marks can be made out of order (revision before QCM still counts as started)",
  computeSubjectCompletion([item("revision")]),
  { total: 1, done: 0, inProgress: 1, notStarted: 0, ticks: 1, possible: 7, pct: 14 }
);

check(
  "aggregates across a mixed list",
  computeSubjectCompletion([item(...STAGES), item("couche_1"), item(), item(...STAGES)]),
  { total: 4, done: 2, inProgress: 1, notStarted: 1, ticks: 15, possible: 28, pct: 54 }
);

/* A partly-read subject must never read as finished, and a finished one
   must never read as less. */
check(
  "one pass over every lesson is progress, not readiness",
  computeSubjectCompletion([item("couche_1"), item("couche_1"), item("couche_1")]),
  { total: 3, done: 0, inProgress: 3, notStarted: 0, ticks: 3, possible: 21, pct: 14 }
);

// --- exam countdown ----------------------------------------------------
const today = new Date("2026-09-06T09:00:00Z");
check("no date set yields null", daysUntilExam(null, today), null);
check("exam today is 0 days", daysUntilExam("2026-09-06", today), 0);
check("exam tomorrow is 1 day", daysUntilExam("2026-09-07", today), 1);
check("exam in a month", daysUntilExam("2026-10-06", today), 30);
check("a past exam is negative", daysUntilExam("2026-09-01", today), -5);
check("garbage date yields null instead of NaN", daysUntilExam("not-a-date", today), null);

// --- stage guard -------------------------------------------------------
for (const s of STAGES) check(`isStage accepts "${s}"`, isStage(s), true);
check("isStage rejects an unrelated column", isStage("deleted_at"), false);
check("isStage rejects the old stage names", isStage("understood"), false);
check("isStage rejects a SQL-ish payload", isStage("couche_1; drop table"), false);

// --- permissions -------------------------------------------------------
check("student BLOCKED from the admin study editor", canAccessPath("student", "/admin/study-tracking"), false);
check("student BLOCKED from a specific subject editor", canAccessPath("student", "/admin/study-tracking/abc"), false);
check("teacher BLOCKED from the admin study editor", canAccessPath("teacher", "/admin/study-tracking"), false);
check("admin may open the study editor", canAccessPath("admin", "/admin/study-tracking"), true);
check("signed-out visitor blocked from the student view", canAccessPath(null, "/dashboard/study"), false);
check("student may open their own study view", canAccessPath("student", "/dashboard/study"), true);

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
