"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasActiveEnrollment } from "@/lib/db/guard";
import { refreshCourseRating } from "@/lib/data/counters";
import { requireRouteAccess } from "@/lib/auth/session";

export type ReviewActionState = { error: string | null; success?: string | null };

const VALID_REACTIONS = ["loved", "fire", "like", "thinking", "sad"];

/**
 * Create or edit a course review.
 *
 * The enrollment rule is the important part. reviews_insert_enrolled_only
 * (0019) enforced "you may only review a course you actually bought" in
 * the database, and the old action's own comment said it "still checks
 * first for a friendly error message, but the database would reject an
 * unenrolled insert regardless of what this code does".
 *
 * The database rejects nothing now. This check IS the rule — without it
 * anyone with an account could rate any course, which is exactly the
 * shape review spam takes.
 *
 * Uniqueness stays a select-then-insert-or-update rather than ON
 * DUPLICATE KEY UPDATE: uq_reviews_active_user_course was a PARTIAL
 * index (WHERE deleted_at IS NULL) and has no MariaDB equivalent, so
 * there is no unique key for a duplicate-key clause to fire on.
 */
export async function upsertReviewAction(
  courseId: string,
  courseSlug: string,
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const rating = Number(formData.get("rating"));
  const reaction = String(formData.get("reaction") ?? "");
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "الرجاء اختيار تقييم من 1 إلى 5 نجوم" };
  }
  if (reaction && !VALID_REACTIONS.includes(reaction)) {
    return { error: "رمز تعبيري غير صالح" };
  }

  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  if (!(await hasActiveEnrollment(user.id, courseId))) {
    return { error: "يجب الاشتراك في هذه الدورة لتتمكن من تقييمها" };
  }

  try {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM reviews WHERE user_id = ? AND course_id = ? AND deleted_at IS NULL`,
      [user.id, courseId]
    );

    if (existing) {
      // `user_id = ?` as well as the id: the row was just read as the
      // caller's own, but repeating it keeps the write self-contained.
      await execute(
        `UPDATE reviews SET rating = ?, reaction = ?, comment = ? WHERE id = ? AND user_id = ?`,
        [rating, reaction || null, comment, existing.id, user.id]
      );
      /*
        KEEP courses.rating IN STEP.

        The catalogue and the course card read the stored column, not
        the reviews table — refreshCourseRating existed for this and
        nothing called it, so a course's star rating never moved after
        the first time it was set. Same family of bug as min_price.
      */
      await refreshCourseRating(courseId);
      revalidatePath(`/courses/${courseSlug}`);
      return { error: null, success: "تم تحديث تقييمك" };
    }

    await execute(
      `INSERT INTO reviews (id, user_id, course_id, rating, reaction, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), user.id, courseId, rating, reaction || null, comment]
    );
  } catch {
    return { error: "تعذّر إرسال التقييم" };
  }

  await refreshCourseRating(courseId);
  revalidatePath(`/courses/${courseSlug}`);
  return { error: null, success: "شكراً لتقييمك" };
}

/**
 * Toggles the "helpful" reaction on somebody else's review.
 *
 * The unique key on (review_id, user_id, reaction_type) is what makes
 * this safe to run twice: the DELETE and INSERT are both scoped to the
 * caller's own reaction, so a double-click cannot produce two rows or
 * remove anyone else's.
 */
export async function toggleReviewHelpfulAction(reviewId: string, courseSlug: string) {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM review_reactions
        WHERE review_id = ? AND user_id = ? AND reaction_type = 'helpful'`,
      [reviewId, user.id]
    );

    if (existing) {
      await execute(`DELETE FROM review_reactions WHERE id = ? AND user_id = ?`, [
        existing.id,
        user.id,
      ]);
    } else {
      await execute(
        `INSERT INTO review_reactions (id, review_id, user_id, reaction_type)
         VALUES (?, ?, ?, 'helpful')`,
        [newId(), reviewId, user.id]
      );
    }
  } catch {
    return { error: "تعذّر حفظ التفاعل" };
  }

  revalidatePath(`/courses/${courseSlug}`);
  return { error: null };
}

/**
 * Removes a review. Admins only.
 *
 * Soft-deleted, like everything else that a student wrote: a review
 * taken down for being abusive is still evidence if the student
 * disputes it, and `deleted_at` is what every read already filters on.
 *
 * The course's stored rating is recomputed immediately — a deleted
 * one-star review that still drags the average down is the deletion
 * not having happened as far as anybody can see.
 */
export async function deleteReviewAction(reviewId: string): Promise<ReviewActionState> {
  await requireRouteAccess("/admin");

  const review = await queryOne<{ course_id: string }>(
    `SELECT course_id FROM reviews WHERE id = ? LIMIT 1`,
    [reviewId]
  );
  if (!review) return { error: "التقييم غير موجود" };

  await execute(
    `UPDATE reviews SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`,
    [reviewId]
  );

  await refreshCourseRating(review.course_id);

  revalidatePath("/admin/reviews");
  return { error: null, success: "حُذف التقييم" };
}
