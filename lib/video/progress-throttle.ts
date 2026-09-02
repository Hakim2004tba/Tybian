/**
 * Pure decision functions for the video player's progress tracking —
 * kept free of timers/DOM/network so they're directly unit-testable
 * (see tests/learn-progress.test.ts), following the same
 * decide-vs-gather-facts split used throughout this project
 * (lib/auth/route-access.ts, lib/video/access.ts).
 */

export type FlushDecisionInput = {
  secondsSinceLastFlush: number;
  minIntervalSeconds: number;
  /** true for pause/ended/tab-hidden/unmount — always flush regardless
   *  of the interval, so we never lose the final position. */
  isForcedFlush: boolean;
};

/**
 * "لا ترسل request إلى database كل ثانية. استخدم debouncing/throttling."
 * — this is the throttle: a periodic timeupdate only triggers a save
 * once at least `minIntervalSeconds` has elapsed since the last one,
 * but a forced flush (pause, lesson end, navigating away) always saves
 * immediately so the resume position is never stale by more than a
 * user-visible pause/leave action.
 */
export function shouldFlushProgress(input: FlushDecisionInput): boolean {
  if (input.isForcedFlush) return true;
  return input.secondsSinceLastFlush >= input.minIntervalSeconds;
}

export function isLessonComplete(
  currentTimeSeconds: number,
  durationSeconds: number,
  thresholdPct = 0.9
): boolean {
  if (durationSeconds <= 0) return false;
  return currentTimeSeconds / durationSeconds >= thresholdPct;
}
