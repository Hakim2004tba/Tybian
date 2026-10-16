"use server";

import { getSessionUser } from "@/lib/auth/session";
import { hasActiveEnrollment, isAdmin, isOwningTeacher } from "@/lib/db/guard";
import { queryOne } from "@/lib/db";
import { submitAttempt, type Correction } from "@/lib/data/quiz";

export type SubmitResult =
  | { ok: true; correction: Correction }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" };

/**
 * Grades a student's QCM submission.
 *
 * The browser sends only which propositions were ticked. It never sends
 * a score, and it never receives the answer key until this action has
 * already graded the attempt — the key travels back in the RESULT, not
 * in the page. That ordering is the whole protection: a student cannot
 * read an answer they have not yet answered for.
 */
export async function submitQuizAction(
  lessonId: string,
  mode: "training" | "exam",
  chosen: Record<string, string[]>,
  /**
   * Practice mode only: the single question being corrected right now.
   *
   * Without it, checking question 1 returned the key to EVERY question
   * in the set — the whole answer sheet, sitting in the response for
   * anyone who opened devtools. The correction is narrowed to the one
   * question the student has actually answered.
   */
  revealQuestionId?: string
): Promise<SubmitResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  /*
    The lesson decides the course, and the course decides access. Taking
    the course id from the caller instead would let a student submit
    against a lesson they cannot open.
  */
  const lesson = await queryOne<{ course_id: string; is_free_preview: number }>(
    `SELECT s.course_id, l.is_free_preview
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
      WHERE l.id = ? AND l.deleted_at IS NULL
      LIMIT 1`,
    [lessonId]
  );
  if (!lesson) return { ok: false, reason: "not_found" };

  /*
    Enrolment, not merely "the course is published".

    canViewCourse() would have passed anyone here: it answers whether a
    course may be SEEN in the catalogue, and a published course is
    public by design. Its questions are not — they are paid content, and
    using that guard would have handed every QCM in the platform to any
    signed-in visitor. A free-preview lesson is the one exception, and
    it is an explicit flag on the lesson rather than a side effect.
  */
  const allowed =
    lesson.is_free_preview === 1 ||
    (await isAdmin()) ||
    (await isOwningTeacher(user.id, lesson.course_id)) ||
    (await hasActiveEnrollment(user.id, lesson.course_id));

  if (!allowed) return { ok: false, reason: "forbidden" };

  const correction = await submitAttempt(user.id, lessonId, mode, chosen);

  if (revealQuestionId) {
    const keys = correction.keys[revealQuestionId]
      ? { [revealQuestionId]: correction.keys[revealQuestionId] }
      : {};
    return {
      ok: true,
      correction: {
        ...correction,
        keys,
        verdicts: correction.verdicts.filter((v) => v.questionId === revealQuestionId),
      },
    };
  }

  return { ok: true, correction };
}
