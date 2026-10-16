import "server-only";
import { execute, newId } from "@/lib/db";

/**
 * The lesson-progress upsert, shared by the player heartbeat and the
 * manual "mark complete" button.
 *
 * This lives in its own module, NOT in a "use server" file, and that is
 * a security requirement rather than tidiness. Every export of a
 * "use server" module becomes a server action: a callable endpoint the
 * browser can invoke with whatever arguments it likes. This function
 * takes `userId` as a parameter, so exporting it from an actions file
 * would publish "write any progress row for any user" to the internet.
 *
 * The actions that wrap it take no user id at all — they read it from
 * the session. Keep it that way.
 *
 * Two rules are enforced in the ON DUPLICATE KEY UPDATE clause rather
 * than by reading the row first:
 *
 *   GREATEST(...)   the furthest point reached never goes backwards, so
 *                   re-watching from the start keeps the bookmark.
 *   is_completed OR VALUES(...)
 *                   completion is monotonic — once done, a later
 *                   heartbeat cannot un-complete it.
 *
 * Expressing both in SQL also closes a race the old read-then-write code
 * had: two heartbeats in flight could each read the same old row, and
 * the later write would silently discard the earlier one's progress.
 */
export async function upsertProgress(
  userId: string,
  lessonId: string,
  positionSeconds: number,
  completed: boolean
): Promise<void> {
  const position = Math.max(0, Math.round(positionSeconds));

  await execute(
    `INSERT INTO lesson_progress
       (id, user_id, lesson_id, last_position_seconds, is_completed, completed_at)
     VALUES (?, ?, ?, ?, ?, ${completed ? "UTC_TIMESTAMP(3)" : "NULL"})
     ON DUPLICATE KEY UPDATE
       last_position_seconds = GREATEST(last_position_seconds, VALUES(last_position_seconds)),
       is_completed          = (is_completed OR VALUES(is_completed)),
       completed_at          = COALESCE(completed_at, VALUES(completed_at))`,
    [newId(), userId, lessonId, position, completed ? 1 : 0]
  );
}
