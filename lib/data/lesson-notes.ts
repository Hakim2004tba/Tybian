import "server-only";
import { queryOne } from "@/lib/db";

/**
 * A student's private note on one lesson.
 *
 * `user_id = ?` is the whole access rule. lesson_notes_select_own used to
 * enforce it in the database as well; now this WHERE clause is the only
 * thing standing between one student's notes and another's. The caller
 * passes the id, but it is always the session's own — see the callers in
 * app/student and the learn page.
 */
export async function getLessonNote(userId: string, lessonId: string): Promise<string> {
  const row = await queryOne<{ body: string | null }>(
    `SELECT body FROM lesson_notes WHERE user_id = ? AND lesson_id = ?`,
    [userId, lessonId]
  );
  // The column is nullable here where Postgres had `not null default ''`
  // — TEXT cannot carry a DEFAULT in MariaDB — so NULL reads as empty.
  return row?.body ?? "";
}
