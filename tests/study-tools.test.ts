// Run with: node --experimental-strip-types tests/study-tools.test.ts

import { computeNextReview, type ReviewState } from "../lib/study/spaced-repetition.ts";
import { computeStreakDays, aggregateLeaderboard, type StudySessionRow } from "../lib/study/leaderboard.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) {
    console.log(`[FAIL] ${name}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------
// computeNextReview (SM-2-lite)
// ---------------------------------------------------------------------
const fresh: ReviewState = { easeFactor: 2.5, intervalDays: 1, repetitions: 0 };

{
  const r = computeNextReview(fresh, "good");
  check("first 'good' review: interval = 1 day", r.intervalDays, 1);
  check("first 'good' review: repetitions = 1", r.repetitions, 1);
  check("first 'good' review: ease unchanged", r.easeFactor, 2.5);
}

{
  const afterFirst: ReviewState = { easeFactor: 2.5, intervalDays: 1, repetitions: 1 };
  const r = computeNextReview(afterFirst, "good");
  check("second 'good' review: interval jumps to 6 days", r.intervalDays, 6);
  check("second 'good' review: repetitions = 2", r.repetitions, 2);
}

{
  const afterSecond: ReviewState = { easeFactor: 2.5, intervalDays: 6, repetitions: 2 };
  const r = computeNextReview(afterSecond, "good");
  check("third 'good' review: interval = round(6 * 2.5) = 15", r.intervalDays, 15);
  check("third 'good' review: repetitions = 3", r.repetitions, 3);
}

{
  const established: ReviewState = { easeFactor: 2.5, intervalDays: 15, repetitions: 3 };
  const r = computeNextReview(established, "again");
  check("'again' resets repetitions to 0", r.repetitions, 0);
  check("'again' resets interval to 1 day", r.intervalDays, 1);
  check("'again' reduces ease factor by 0.2", r.easeFactor, 2.3);
}

{
  // Ease factor never drops below the floor even after repeated lapses.
  const nearFloor: ReviewState = { easeFactor: 1.35, intervalDays: 1, repetitions: 0 };
  const r = computeNextReview(nearFloor, "again");
  check("ease factor floors at 1.3, never goes lower", r.easeFactor, 1.3);
}

{
  const established: ReviewState = { easeFactor: 2.5, intervalDays: 15, repetitions: 3 };
  const easy = computeNextReview(established, "easy");
  const hard = computeNextReview(established, "hard");
  check("'easy' increases ease factor", easy.easeFactor, 2.65);
  check("'hard' decreases ease factor", hard.easeFactor, 2.35);
  check("'easy' produces a longer interval than 'hard'", easy.intervalDays > hard.intervalDays, true);
}

// ---------------------------------------------------------------------
// computeStreakDays
// ---------------------------------------------------------------------
check("no study dates -> streak 0", computeStreakDays([], "2026-08-18"), 0);
check(
  "studied today + 2 prior consecutive days -> streak 3",
  computeStreakDays(["2026-08-18", "2026-08-17", "2026-08-16"], "2026-08-18"),
  3
);
check(
  "gap in the middle breaks the streak (counts only the recent run)",
  computeStreakDays(["2026-08-18", "2026-08-16"], "2026-08-18"),
  1
);
check(
  "hasn't studied YET today, but studied yesterday+before -> streak still counts (not reset to 0)",
  computeStreakDays(["2026-08-17", "2026-08-16"], "2026-08-18"),
  2
);
check(
  "hasn't studied today OR yesterday -> streak is 0 (truly broken)",
  computeStreakDays(["2026-08-15"], "2026-08-18"),
  0
);
check(
  "duplicate dates in input don't inflate the streak",
  computeStreakDays(["2026-08-18", "2026-08-18", "2026-08-17"], "2026-08-18"),
  2
);

// ---------------------------------------------------------------------
// aggregateLeaderboard
// ---------------------------------------------------------------------
{
  const sessions: StudySessionRow[] = [
    { userId: "a", durationSeconds: 1500, date: "2026-08-18" }, // this week
    { userId: "a", durationSeconds: 1500, date: "2026-08-17" }, // this week
    { userId: "a", durationSeconds: 1500, date: "2026-07-01" }, // outside the week, still counts for streak window but not weekly total
    { userId: "b", durationSeconds: 5000, date: "2026-08-18" }, // this week, clearly more total (no tie)
  ];

  const result = aggregateLeaderboard(sessions, "2026-08-12", "2026-08-18");

  check("leaderboard sorted by weekly seconds descending (b first)", result[0].userId, "b");
  check("user b weekly total", result[0].weeklySeconds, 5000);
  check("user a weekly total excludes the July session", result[1].weeklySeconds, 3000);
  check("user a streak includes today+yesterday", result[1].streakDays, 2);
  check("user b streak is 1 (only studied today)", result[0].streakDays, 1);
}

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
