"use server";

import { execute, newId } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Saves a student's private note on a lesson.
 *
 * `user_id` comes from the session, so this can only ever write the
 * caller's own note — the same guarantee lesson_notes_owner_all gave in
 * Postgres, now made here instead.
 *
 * The unique key on (user_id, lesson_id) is plain rather than partial, so
 * ON DUPLICATE KEY UPDATE is enough and none of the select-then-write
 * dance that the partial-index cases elsewhere need.
 */
export async function saveLessonNoteAction(lessonId: string, body: string) {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    await execute(
      `INSERT INTO lesson_notes (id, user_id, lesson_id, body)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE body = VALUES(body)`,
      [newId(), user.id, lessonId, body]
    );
  } catch {
    return { error: "تعذّر حفظ الملاحظة" };
  }

  return { error: null };
}
