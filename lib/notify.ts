import "server-only";
import { newId, pool } from "@/lib/db";

/**
 * Creating a notification, in one place.
 *
 * WHY THIS EXISTS: the bell, the unread count and the mark-read action
 * all worked — and the bell was always empty, because nothing in the
 * app ever wrote a row. The only producer was the admin's manual
 * broadcast, so "notifications don't work" was accurate from a
 * student's side even though every part of the plumbing did.
 *
 * NEVER THROWS. A notification is a side effect of something that
 * already succeeded — a reply was posted, a payment settled — and
 * failing to announce it must not undo it. Errors are logged and
 * swallowed; the worst case is a missing bell entry, not a lost reply.
 *
 * Takes its own connection rather than joining the caller's
 * transaction, on purpose: the notification is not part of what must
 * commit atomically, and holding a transaction open across it would
 * make every write wait on this one.
 */

export type NotificationType =
  | "payment_success"
  | "payment_failed"
  | "enrollment_activated"
  | "enrollment_expiring"
  | "course_update"
  | "comment_reply"
  | "question_answered"
  | "certificate_issued"
  | "system";

export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** What it points at, so the bell can link somewhere useful. */
  entityType?: string | null;
  entityId?: string | null;
}): Promise<void> {
  try {
    await pool().query(
      `INSERT INTO notifications
         (id, user_id, type, title, body, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        input.userId,
        input.type,
        input.title.slice(0, 255),
        input.body ?? null,
        input.entityType ?? null,
        input.entityId ?? null,
      ]
    );
  } catch (error) {
    console.error("[notify] failed", error);
  }
}

/** The same notification to several people, in one statement. */
export async function notifyMany(
  userIds: string[],
  input: Omit<Parameters<typeof notify>[0], "userId">
): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    /* Chunked: one statement per 200 recipients keeps a large course
       from building a single enormous query. */
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const values = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(",");
      const args = chunk.flatMap((userId) => [
        newId(),
        userId,
        input.type,
        input.title.slice(0, 255),
        input.body ?? null,
        input.entityType ?? null,
        input.entityId ?? null,
      ]);
      await pool().query(
        `INSERT INTO notifications
           (id, user_id, type, title, body, related_entity_type, related_entity_id)
         VALUES ${values}`,
        args
      );
    }
  } catch (error) {
    console.error("[notifyMany] failed", error);
  }
}
