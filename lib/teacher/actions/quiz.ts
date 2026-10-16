"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, query, queryOne, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getTeacherScope, ownsLesson } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";

export type ActionState = { error: string | null; success?: string | null };

/**
 * A teacher writing QCM questions for their OWN lessons.
 *
 * Separate from the admin action on purpose. That one starts with
 * requireRouteAccess("/admin") and would simply reject a teacher; more
 * importantly, it trusts the lesson id it is handed, which is right for
 * an admin and wrong here. Passing the /teacher tier says the caller is
 * a teacher — it says nothing about WHOSE lesson they just named. So
 * ownership is proved below, and a crafted lesson id belonging to a
 * colleague is refused.
 */
export async function createTeacherQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRouteAccess("/teacher");
  const { dict } = await getDictionary();
  const t = dict.admin.quiz;

  const scope = await getTeacherScope();
  if (!scope) return { error: t.errLesson };

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  if (!lessonId) return { error: t.errLesson };
  if (!(await ownsLesson(scope, lessonId))) return { error: t.errLesson };

  const stem = String(formData.get("stem") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "qcm") === "qcu" ? "qcu" : "qcm";

  if (!stem) return { error: t.errStem };

  const options: { body: string; isCorrect: boolean }[] = [];
  for (let i = 0; i < 10; i++) {
    const body = String(formData.get(`option${i}`) ?? "").trim();
    if (!body) continue;
    options.push({ body: body.slice(0, 500), isCorrect: formData.get(`correct${i}`) === "on" });
  }

  if (options.length < 2) return { error: t.errTwoOptions };

  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) return { error: t.errNoCorrect };
  if (kind === "qcu" && correctCount > 1) return { error: t.errQcuOne };

  const questionId = newId();

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

  revalidatePath("/teacher/qcm");
  return { error: null, success: t.created };
}

/* ------------------------------------------------------------------ */
/*  Editing what they wrote                                            */
/* ------------------------------------------------------------------ */

/**
 * Proves a question belongs to a lesson this teacher owns.
 *
 * Every mutation below goes through here rather than trusting the id in
 * the form. `ownsLesson` alone is not enough: a crafted request can pair
 * a lesson the teacher does own with a question id from somebody else's
 * lesson, and without the join the update would land on the colleague's
 * question. So the lesson is read FROM the question, then checked.
 */
async function ownedQuestionLesson(
  scope: Awaited<ReturnType<typeof getTeacherScope>>,
  questionId: string
): Promise<string | null> {
  if (!scope || !questionId) return null;
  const row = await queryOne<{ lesson_id: string }>(
    `SELECT lesson_id FROM lesson_questions WHERE id = ? AND deleted_at IS NULL`,
    [questionId]
  );
  if (!row) return null;
  return (await ownsLesson(scope, row.lesson_id)) ? row.lesson_id : null;
}

/**
 * Reads and validates the question fields shared by create and update.
 *
 * The result is a discriminated union on `ok` rather than "error is
 * null": only the former narrows, and without it the caller's field
 * accesses stay possibly-undefined and land on the wrong `execute`
 * overload.
 */
type ParsedQuestion =
  | { ok: false; error: string }
  | {
      ok: true;
      stem: string;
      explanation: string | null;
      kind: "qcm" | "qcu";
      options: { body: string; isCorrect: boolean }[];
    };

function parseQuestion(
  formData: FormData,
  t: { errStem: string; errTwoOptions: string; errNoCorrect: string; errQcuOne: string }
): ParsedQuestion {
  const stem = String(formData.get("stem") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "qcm") === "qcu" ? "qcu" : "qcm";

  if (!stem) return { ok: false, error: t.errStem };

  const options: { body: string; isCorrect: boolean }[] = [];
  for (let i = 0; i < 10; i++) {
    const body = String(formData.get(`option${i}`) ?? "").trim();
    if (!body) continue;
    options.push({ body: body.slice(0, 500), isCorrect: formData.get(`correct${i}`) === "on" });
  }

  if (options.length < 2) return { ok: false, error: t.errTwoOptions };

  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) return { ok: false, error: t.errNoCorrect };
  if (kind === "qcu" && correctCount > 1) return { ok: false, error: t.errQcuOne };

  return { ok: true, stem, explanation, kind, options };
}

/**
 * Rewrites a question and its options.
 *
 * The options are REPLACED, not patched: the form has no stable option
 * ids, and matching old rows to new text by position silently keeps a
 * wrong answer key when a teacher reorders the choices. Old option rows
 * are hard-deleted because nothing points at them — attempts store the
 * option ids they chose in their own table, and a graded attempt keeps
 * the score it was given. What a student sees when they revisit an
 * attempt is the question as it stands now, which is the same thing
 * that happens when an admin edits one.
 */
export async function updateTeacherQuestionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/teacher");
  const { dict } = await getDictionary();
  const t = dict.admin.quiz;

  const scope = await getTeacherScope();
  const questionId = String(formData.get("questionId") ?? "").trim();
  const lessonId = await ownedQuestionLesson(scope, questionId);
  if (!lessonId) return { error: t.errLesson };

  const parsed = parseQuestion(formData, t);
  if (!parsed.ok) return { error: parsed.error };

  await transaction(async (tx) => {
    await tx.execute(
      `UPDATE lesson_questions SET kind = ?, stem = ?, explanation = ? WHERE id = ?`,
      [parsed.kind, parsed.stem, parsed.explanation, questionId]
    );
    await tx.execute(`DELETE FROM lesson_question_options WHERE question_id = ?`, [questionId]);
    for (const [i, o] of parsed.options.entries()) {
      await tx.execute(
        `INSERT INTO lesson_question_options (id, question_id, position, body, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        [newId(), questionId, i, o.body, o.isCorrect ? 1 : 0]
      );
    }
  });

  revalidatePath("/teacher/qcm");
  return { error: null, success: t.updated };
}

/**
 * Soft delete, for the same reason the admin's is soft: recorded
 * attempts point at this question, and removing the row would take a
 * student's history and the class statistics with it.
 */
export async function deleteTeacherQuestionAction(questionId: string): Promise<ActionState> {
  await requireRouteAccess("/teacher");
  const { dict } = await getDictionary();

  const scope = await getTeacherScope();
  if (!(await ownedQuestionLesson(scope, questionId))) {
    return { error: dict.admin.quiz.errLesson };
  }

  await execute(
    `UPDATE lesson_questions SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`,
    [questionId]
  );

  revalidatePath("/teacher/qcm");
  return { error: null, success: dict.admin.quiz.deleted };
}

/**
 * Moves a question one place up or down within its lesson.
 *
 * Swaps the two `position` values rather than renumbering the list, so
 * the write touches two rows whatever the length. Positions can start
 * out duplicated — every question created before ordering existed got
 * one — so the neighbour is chosen by the SAME ordering the student
 * sees (position, then created_at) instead of by `position = n ± 1`,
 * which would find nothing on a tie.
 */
export async function moveTeacherQuestionAction(
  questionId: string,
  direction: "up" | "down"
): Promise<ActionState> {
  await requireRouteAccess("/teacher");
  const { dict } = await getDictionary();

  const scope = await getTeacherScope();
  const lessonId = await ownedQuestionLesson(scope, questionId);
  if (!lessonId) return { error: dict.admin.quiz.errLesson };

  const ordered = await query<{ id: string }>(
    `SELECT id FROM lesson_questions
      WHERE lesson_id = ? AND deleted_at IS NULL
      ORDER BY position ASC, created_at ASC`,
    [lessonId]
  );

  const index = ordered.findIndex((q) => q.id === questionId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ordered.length) {
    return { error: null }; // already at the end — nothing to do, not an error
  }

  /*
    Renumber the whole lesson from the reordered array. A swap of two
    position values is not enough here precisely BECAUSE the old rows
    can share a position: two questions both at 0 would swap 0 for 0.
    The list is short — one question per row, a handful per lesson.
  */
  const reordered = [...ordered];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);

  await transaction(async (tx) => {
    for (const [i, q] of reordered.entries()) {
      await tx.execute(`UPDATE lesson_questions SET position = ? WHERE id = ?`, [i, q.id]);
    }
  });

  revalidatePath("/teacher/qcm");
  return { error: null, success: dict.admin.quiz.reordered };
}
