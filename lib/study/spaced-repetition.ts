/**
 * Simplified SM-2 (the algorithm behind Anki) — kept pure and
 * dependency-free so it's directly unit-testable, same pattern as
 * lib/video/progress-throttle.ts and lib/video/adjacent-lessons.ts.
 * The Server Action (lib/actions/spaced-repetition.ts) is a thin
 * wrapper that reads the current row, calls this, and writes the
 * result back — all the actual scheduling logic lives here.
 */

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

const MIN_EASE_FACTOR = 1.3;

export function computeNextReview(current: ReviewState, rating: ReviewRating): ReviewState {
  // "Again" — forgot it. Reset the streak entirely and schedule for
  // tomorrow, same as Anki's "lapse" behavior, but don't let a single
  // lapse wreck the ease factor irrecoverably (floor at MIN_EASE_FACTOR).
  if (rating === "again") {
    return {
      easeFactor: Math.max(MIN_EASE_FACTOR, current.easeFactor - 0.2),
      intervalDays: 1,
      repetitions: 0,
    };
  }

  const easeDelta = rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : 0;
  const easeFactor = Math.max(MIN_EASE_FACTOR, current.easeFactor + easeDelta);
  const repetitions = current.repetitions + 1;

  let intervalDays: number;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round(current.intervalDays * easeFactor));

  return { easeFactor, intervalDays, repetitions };
}
