"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Writing QCM questions. Admin only.
 *
 * A question and its propositions are written in ONE transaction: a
 * question that reached the database without its options would appear
 * to students as a stem with nothing to tick, and a half-written
 * question is worse than no question at all.
 */
export async function createQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRouteAccess("/admin");
  const { dict } = await getDictionary();
  const t = dict.admin.quiz;

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const stem = String(formData.get("stem") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "qcm") === "qcu" ? "qcu" : "qcm";

  if (!lessonId) return { error: t.errLesson };
  if (!stem) return { error: t.errStem };

  const lesson = await queryOne<{ id: string }>(
    `SELECT id FROM lessons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [lessonId]
  );
  if (!lesson) return { error: t.errLesson };

  /* Propositions arrive as option0..optionN with correct0..correctN. */
  const options: { body: string; isCorrect: boolean }[] = [];
  for (let i = 0; i < 10; i++) {
    const body = String(formData.get(`option${i}`) ?? "").trim();
    if (!body) continue;
    options.push({ body: body.slice(0, 500), isCorrect: formData.get(`correct${i}`) === "on" });
  }

  if (options.length < 2) return { error: t.errTwoOptions };

  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) return { error: t.errNoCorrect };

  /*
    A QCU with several correct propositions is not a QCU. Refused here
    rather than stored, because the grader would then mark every honest
    single answer wrong and the student would never understand why.
  */
  if (kind === "qcu" && correctCount > 1) return { error: t.errQcuOne };

  const questionId = newId();

  /*
    Read outside the transaction: `tx` is a raw mysql2 connection with
    no queryOne helper, and the value is only a display order — two
    questions created in the same instant landing on the same position
    changes nothing a student would notice.
  */
  const positionRow = await queryOne<{ n: number }>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS n
       FROM lesson_questions WHERE lesson_id = ? AND deleted_at IS NULL`,
    [lessonId]
  );
  const position = Number(positionRow?.n ?? 0);

  await transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO lesson_questions (id, lesson_id, position, kind, stem, explanation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [questionId, lessonId, position, kind, stem, explanation, user.id]
    );

    for (const [i, o] of options.entries()) {
      await tx.execute(
        `INSERT INTO lesson_question_options (id, question_id, position, body, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        [newId(), questionId, i, o.body, o.isCorrect ? 1 : 0]
      );
    }
  });

  revalidatePath(`/admin/lessons/${lessonId}/qcm`);
  return { error: null, success: t.created };
}

export async function deleteQuestionAction(questionId: string, lessonId: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();

  /*
    Soft delete. Attempts already recorded point at this question, and
    a hard delete would cascade them away — taking a student's history
    and the class statistics with it.
  */
  await execute(`UPDATE lesson_questions SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [questionId]);

  revalidatePath(`/admin/lessons/${lessonId}/qcm`);
  return { error: null, success: dict.admin.quiz.deleted };
}
