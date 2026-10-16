"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { parseDocument, estimateSize, MAX_DOCUMENT_BYTES } from "@/lib/sketch/model";

/**
 * The student's writes into their own notebook.
 *
 * `user_id` always comes from the verified session, never from the
 * client. The Supabase version noted that RLS enforced the same rule at
 * the database level, "so a bug here still cannot write into another
 * student's notebook" — that second layer is gone, and the `user_id = ?`
 * in every statement below is now the only one.
 */

export type SaveSketchResult = { error: string | null; id?: string };

export async function saveSketchAction(input: {
  id?: string;
  title: string;
  content: unknown;
  contextLabel?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
}): Promise<SaveSketchResult> {
  const user = await getSessionUser();
  if (!user) return { error: "يجب تسجيل الدخول." };

  const title = input.title.trim().slice(0, 120) || "رسم بلا عنوان";

  // Re-parsed rather than trusted: the client could send anything, and a
  // malformed element would be handed straight back to the renderer on
  // the next load.
  const document = parseDocument(input.content);

  if (estimateSize(document) > MAX_DOCUMENT_BYTES) {
    return { error: "الرسم كبير جداً للحفظ. احذف بعض العناصر أو ابدأ رسماً جديداً." };
  }

  const content = JSON.stringify(document);
  const contextLabel = input.contextLabel?.slice(0, 160) ?? null;

  try {
    if (input.id) {
      /*
        `user_id = ?` in the WHERE clause, not just the id.

        A sketch id is a uuid the client already holds for its own
        sketches, but nothing stops a modified client sending someone
        else's. With the policy gone, this clause is what makes that
        update match zero rows instead of overwriting their drawing.
      */
      const result = await execute(
        `UPDATE sketches
            SET title = ?, content = ?, context_label = ?, course_id = ?, lesson_id = ?
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [title, content, contextLabel, input.courseId ?? null, input.lessonId ?? null, input.id, user.id]
      );

      if (result.affectedRows === 0) {
        // Either it is not theirs or it is gone. Same message for both:
        // confirming the id exists would leak that it does.
        return { error: "تعذّر حفظ الرسم." };
      }

      revalidatePath("/dashboard");
      return { error: null, id: input.id };
    }

    const id = newId();
    await execute(
      `INSERT INTO sketches (id, user_id, title, content, context_label, course_id, lesson_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, title, content, contextLabel, input.courseId ?? null, input.lessonId ?? null]
    );

    revalidatePath("/dashboard");
    return { error: null, id };
  } catch (error) {
    return { error: "تعذّر حفظ الرسم: " + (error as Error).message };
  }
}

/**
 * Soft delete, so a mis-tap does not destroy work the student spent an
 * hour on — the row stays recoverable in the database.
 */
export async function deleteSketchAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "يجب تسجيل الدخول." };

  try {
    await execute(
      `UPDATE sketches SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND user_id = ?`,
      [id, user.id]
    );
  } catch (error) {
    return { error: "تعذّر حذف الرسم: " + (error as Error).message };
  }

  revalidatePath("/dashboard");
  return { error: null };
}

/** Used by the studio to open one sketch — owner-scoped like the rest. */
export async function getSketchAction(id: string) {
  const user = await getSessionUser();
  if (!user) return null;

  return queryOne<{ id: string; title: string; content: unknown }>(
    `SELECT id, title, content FROM sketches
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, user.id]
  );
}
