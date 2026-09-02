/**
 * Pure function computing "الدرس السابق"/"الدرس التالي" navigation and
 * whether the next lesson is locked — separated from data-fetching so
 * it's directly unit-testable (see tests/learn-progress.test.ts).
 */

export type FlatLesson = {
  id: string;
  title: string;
  sectionTitle: string;
  isFreePreview: boolean;
};

export type AdjacentLessons = {
  previous: FlatLesson | null;
  next: FlatLesson | null;
  /** true when `next` exists but the student can't watch it yet
   *  (no active enrollment and it isn't a free-preview lesson) —
   *  the UI shows a lock + subscribe prompt instead of a normal link. */
  nextLocked: boolean;
};

export function getAdjacentLessons(
  orderedLessons: FlatLesson[],
  currentLessonId: string,
  hasAccess: boolean
): AdjacentLessons {
  const index = orderedLessons.findIndex((l) => l.id === currentLessonId);
  if (index === -1) return { previous: null, next: null, nextLocked: false };

  const previous = index > 0 ? orderedLessons[index - 1] : null;
  const next = index < orderedLessons.length - 1 ? orderedLessons[index + 1] : null;
  const nextLocked = next ? !(hasAccess || next.isFreePreview) : false;

  return { previous, next, nextLocked };
}
