"use server";

import { revalidatePath } from "next/cache";
import { execute, newId } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isStage, type Stage } from "@/lib/study/tracking";

/**
 * The ONLY write paths a student has into the study tracker: their own
 * marks, and their own exam date.
 *
 * Deliberately separate from lib/admin/actions/study-tracking.ts, which
 * edits the syllabus and is admin-gated. The split makes "students
 * cannot modify the structure" checkable by reading the imports rather
 * than auditing branches inside one shared file.
 *
 * `user_id` always comes from the verified session, never from the form.
 * RLS (migration 0035) used to enforce that at the database level too;
 * it no longer exists, so this is the only place it is enforced.
 */

export async function toggleStudyStageAction(
  itemId: string,
  stage: Stage,
  nextValue: boolean,
  revalidate?: string
) {
  const user = await getSessionUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  /*
    The stage name becomes a COLUMN NAME below, so it is checked against
    the allow-list first.

    This mattered under Supabase and matters more here: `stage` arrives
    from the client and is interpolated into the SQL text, because a
    column name cannot be a bound parameter. isStage() is what makes
    that safe — it accepts only the seven known names. Never relax it,
    and never interpolate anything else into this statement.
  */
  if (!isStage(stage)) return { error: "خانة غير معروفة" };

  try {
    // ON DUPLICATE KEY UPDATE against the (user_id, item_id) unique key:
    // the first tick inserts, later ticks update. One statement, so
    // ticking two boxes quickly cannot race into a lost update.
    await execute(
      `INSERT INTO study_item_progress (id, user_id, item_id, \`${stage}\`)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`${stage}\` = VALUES(\`${stage}\`)`,
      [newId(), user.id, itemId, nextValue ? 1 : 0]
    );
  } catch (error) {
    return { error: "تعذّر حفظ التقدّم: " + (error as Error).message };
  }

  revalidatePath(revalidate ?? "/dashboard/study");
  return { error: null };
}

/**
 * The student sets their OWN exam date per subject — students in the
 * same year can sit a subject on different dates, and the person who
 * knows the real one is the person revising for it.
 *
 * An empty date clears it (deletes the row) rather than storing a blank,
 * so "I haven't decided yet" stays representable.
 */
export async function setSubjectExamDateAction(
  subjectId: string,
  examDate: string | null,
  revalidate?: string
) {
  const user = await getSessionUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  try {
    if (!examDate) {
      await execute(
        `DELETE FROM study_subject_exams WHERE user_id = ? AND subject_id = ?`,
        [user.id, subjectId]
      );
      revalidatePath(revalidate ?? "/dashboard/study");
      return { error: null };
    }

    // Reject anything that is not a plain YYYY-MM-DD calendar date
    // before it reaches a DATE column. MariaDB in its default
    // non-strict mode would otherwise store '0000-00-00' for a
    // malformed value and the countdown would render nonsense.
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(examDate) ||
      Number.isNaN(new Date(`${examDate}T00:00:00Z`).getTime())
    ) {
      return { error: "تاريخ غير صالح" };
    }

    await execute(
      `INSERT INTO study_subject_exams (id, user_id, subject_id, exam_date)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE exam_date = VALUES(exam_date)`,
      [newId(), user.id, subjectId, examDate]
    );
  } catch (error) {
    return { error: "تعذّر حفظ تاريخ الامتحان: " + (error as Error).message };
  }

  revalidatePath(revalidate ?? "/dashboard/study");
  return { error: null };
}
