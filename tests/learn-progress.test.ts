// Run with: node --experimental-strip-types tests/learn-progress.test.ts

import { shouldFlushProgress, isLessonComplete } from "../lib/video/progress-throttle.ts";
import { getAdjacentLessons, type FlatLesson } from "../lib/video/adjacent-lessons.ts";

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
// shouldFlushProgress — the throttle guarding "no request every second"
// ---------------------------------------------------------------------
check(
  "does NOT flush 1s after the last save (well under a 15s interval)",
  shouldFlushProgress({ secondsSinceLastFlush: 1, minIntervalSeconds: 15, isForcedFlush: false }),
  false
);
check(
  "does NOT flush at 14s (just under the interval)",
  shouldFlushProgress({ secondsSinceLastFlush: 14, minIntervalSeconds: 15, isForcedFlush: false }),
  false
);
check(
  "DOES flush at exactly the interval boundary (15s)",
  shouldFlushProgress({ secondsSinceLastFlush: 15, minIntervalSeconds: 15, isForcedFlush: false }),
  true
);
check(
  "DOES flush well past the interval (60s)",
  shouldFlushProgress({ secondsSinceLastFlush: 60, minIntervalSeconds: 15, isForcedFlush: false }),
  true
);
check(
  "a FORCED flush (pause/ended/unmount) fires even at 0s since last save",
  shouldFlushProgress({ secondsSinceLastFlush: 0, minIntervalSeconds: 15, isForcedFlush: true }),
  true
);

// ---------------------------------------------------------------------
// isLessonComplete
// ---------------------------------------------------------------------
check("89% watched is NOT complete (below 90% threshold)", isLessonComplete(89, 100), false);
check("90% watched IS complete (at threshold)", isLessonComplete(90, 100), true);
check("100% watched IS complete", isLessonComplete(100, 100), true);
check("0 duration never completes (avoid divide-by-zero false positive)", isLessonComplete(0, 0), false);
check("a custom lower threshold (50%) completes earlier", isLessonComplete(50, 100, 0.5), true);

// ---------------------------------------------------------------------
// getAdjacentLessons
// ---------------------------------------------------------------------
const lessons: FlatLesson[] = [
  { id: "l1", title: "Lesion 01", sectionTitle: "Ostéologie", isFreePreview: true },
  { id: "l2", title: "Lesion 02", sectionTitle: "Ostéologie", isFreePreview: false },
  { id: "l3", title: "Lesion 03", sectionTitle: "Ostéologie", isFreePreview: false },
  { id: "l4", title: "Lesion 04", sectionTitle: "Arthrologie", isFreePreview: false },
];

{
  const r = getAdjacentLessons(lessons, "l1", false);
  check("first lesson: no previous", r.previous, null);
  check("first lesson: next is l2", r.next?.id, "l2");
  check("first lesson: next locked when no access and l2 isn't free", r.nextLocked, true);
}
{
  const r = getAdjacentLessons(lessons, "l1", true);
  check("with active access: next NOT locked even for a non-preview lesson", r.nextLocked, false);
}
{
  const r = getAdjacentLessons(lessons, "l4", false);
  check("last lesson: no next", r.next, null);
  check("last lesson: previous is l3", r.previous?.id, "l3");
  check("last lesson: nextLocked false when there is no next at all", r.nextLocked, false);
}
{
  const r = getAdjacentLessons(lessons, "does-not-exist", true);
  check("unknown current lesson id: previous is null", r.previous, null);
  check("unknown current lesson id: next is null", r.next, null);
}
{
  // A free-preview lesson as the NEXT one is always reachable, even
  // with zero course access — this is the whole point of free preview.
  const previewLessons: FlatLesson[] = [
    { id: "a", title: "A", sectionTitle: "S", isFreePreview: false },
    { id: "b", title: "B", sectionTitle: "S", isFreePreview: true },
  ];
  const r = getAdjacentLessons(previewLessons, "a", false);
  check("next is free-preview -> never locked, regardless of access", r.nextLocked, false);
}

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
