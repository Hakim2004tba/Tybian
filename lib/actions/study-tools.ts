"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne, toSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { computeNextReview, type ReviewRating } from "@/lib/study/spaced-repetition";

export type RecordReviewResult = { error: string | null; nextReviewInDays?: number };

/**
 * Records a spaced-repetition grade and schedules the next review.
 *
 * The SM-2 arithmetic stays in computeNextReview() — a pure function
 * with its own tests, untouched by this port. Only the reads and writes
 * around it changed.
 *
 * `user_id = ?` appears in both the SELECT and the UPDATE. The SELECT's
 * copy is what makes "لم يتم العثور على هذه المراجعة" correct rather
 * than a lie, and the UPDATE's is what stops a forged reviewId
 * rescheduling another student's card even if the read were ever
 * loosened.
 */
export async function recordReviewAction(
  reviewId: string,
  rating: ReviewRating
): Promise<RecordReviewResult> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const current = await queryOne<{
    ease_factor: string;
    interval_days: number;
    repetitions: number;
  }>(
    `SELECT ease_factor, interval_days, repetitions
       FROM lesson_reviews
      WHERE id = ? AND user_id = ?`,
    [reviewId, user.id]
  );

  if (!current) return { error: "لم يتم العثور على هذه المراجعة" };

  const next = computeNextReview(
    {
      // DECIMAL(3,2) arrives as a string, so this conversion is required
      // rather than defensive — Number() on the raw value would be NaN
      // and the ease factor would silently corrupt.
      easeFactor: Number(current.ease_factor),
      intervalDays: current.interval_days,
      repetitions: current.repetitions,
    },
    rating
  );

  try {
    await execute(
      `UPDATE lesson_reviews
          SET ease_factor      = ?,
              interval_days    = ?,
              repetitions      = ?,
              last_reviewed_at = UTC_TIMESTAMP(3),
              next_review_at   = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? DAY)
        WHERE id = ? AND user_id = ?`,
      [next.easeFactor, next.intervalDays, next.repetitions, next.intervalDays, reviewId, user.id]
    );
  } catch {
    return { error: "تعذّر حفظ تقييم المراجعة" };
  }

  revalidatePath("/dashboard");
  return { error: null, nextReviewInDays: next.intervalDays };
}

export async function logStudySessionAction(durationSeconds: number, startedAt: string) {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  // Sessions under 30 seconds are not worth a row; silently ignored, as
  // before, rather than reported as an error.
  if (durationSeconds < 30) return { error: null };

  /*
    `started_at` comes from the browser, so it is clamped rather than
    trusted. The CHECK constraint bounds the duration to six hours and
    MariaDB does enforce it — but a bogus far-future start date would
    pass that check and then distort the streak calculation, which reads
    these timestamps by day.
  */
  const started = new Date(startedAt);
  const safeStart = Number.isFinite(started.getTime()) && started.getTime() <= Date.now()
    ? started
    : new Date();

  try {
    await execute(
      `INSERT INTO study_sessions (id, user_id, duration_seconds, started_at)
       VALUES (?, ?, ?, ?)`,
      [
        newId(),
        user.id,
        Math.min(Math.round(durationSeconds), 6 * 60 * 60),
        toSql(safeStart),
      ]
    );
  } catch {
    return { error: "تعذّر حفظ جلسة الدراسة" };
  }

  revalidatePath("/dashboard");
  return { error: null };
}
