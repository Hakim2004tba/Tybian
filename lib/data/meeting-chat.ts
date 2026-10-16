import "server-only";
import { query, queryOne } from "@/lib/db";
import { tablesExist } from "@/lib/db/tables";

/**
 * The persistent discussion on a live session.
 *
 * Reads only. Everything that writes goes through lib/actions, where
 * the permission checks live — a data module that both reads and writes
 * invites a caller to skip the action and its guards.
 */

export const CHAT_TABLES = ["meeting_messages"];

export type MeetingMessage = {
  id: string;
  body: string;
  user_id: string;
  author_name: string;
  author_role: "student" | "teacher" | "admin";
  is_pinned: number;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingThread = MeetingMessage & { replies: MeetingMessage[] };

/**
 * Every message on the session, threaded one level deep.
 *
 * Pinned first, then oldest-first — a discussion reads forward, unlike
 * a feed. The whole conversation comes back in one query and is
 * threaded in memory: a session's discussion is tens of messages, not
 * thousands, and a second round trip per thread would cost more than
 * the grouping does.
 */
export async function listMessages(meetingId: string): Promise<MeetingThread[]> {
  if (!(await tablesExist(CHAT_TABLES))) return [];

  const rows = await query<MeetingMessage>(
    `SELECT m.id, m.body, m.user_id, m.is_pinned, m.reply_to_id, m.created_at, m.updated_at,
            p.full_name AS author_name,
            p.role      AS author_role
       FROM meeting_messages m
       JOIN profiles p ON p.id = m.user_id
      WHERE m.meeting_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC`,
    [meetingId]
  );

  const byParent = new Map<string, MeetingMessage[]>();
  const roots: MeetingMessage[] = [];

  for (const row of rows) {
    if (row.reply_to_id) {
      const list = byParent.get(row.reply_to_id) ?? [];
      list.push(row);
      byParent.set(row.reply_to_id, list);
    } else {
      roots.push(row);
    }
  }

  const threads = roots.map((r) => ({ ...r, replies: byParent.get(r.id) ?? [] }));

  /*
    Pinned to the top, and stable within each group. `sort` is stable in
    every engine this runs on, so the created_at order the query already
    produced survives.
  */
  return threads.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
}

/** One message, for the ownership checks the write actions make. */
export async function getMessage(id: string): Promise<{
  id: string;
  meeting_id: string;
  user_id: string;
} | null> {
  if (!(await tablesExist(CHAT_TABLES))) return null;
  return queryOne(
    `SELECT id, meeting_id, user_id FROM meeting_messages WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
}

export async function countMessages(meetingId: string): Promise<number> {
  if (!(await tablesExist(CHAT_TABLES))) return 0;
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM meeting_messages WHERE meeting_id = ? AND deleted_at IS NULL`,
    [meetingId]
  );
  return Number(row?.n ?? 0);
}

/**
 * A cheap "has anything changed?" marker for the chat.
 *
 * WHY: every viewer polls the thread every ten seconds. A live session
 * with two hundred students is twenty requests a second, each of which
 * was returning the WHOLE conversation — joined to profiles, rebuilt
 * into threads, re-sent — whether or not a single word had been added.
 * During a quiet stretch of a lecture that is pure waste, and it is
 * waste that scales linearly with the size of the audience: exactly the
 * shape that takes a shared host down.
 *
 * This returns two numbers. The count moves when a message is added,
 * deleted or restored; the timestamp moves when one is edited or
 * pinned. Together they catch every change the thread view can show.
 * The client fetches the real thread only when the pair differs from
 * what it already has.
 *
 * It reads from meeting_messages_meeting_idx (meeting_id, deleted_at,
 * created_at) — an index-only aggregate, no profile join, no sort, and
 * about thirty bytes on the wire.
 */
export async function messagesVersion(meetingId: string): Promise<{ count: number; stamp: number }> {
  if (!(await tablesExist(CHAT_TABLES))) return { count: 0, stamp: 0 };

  const row = await queryOne<{ c: number; t: number | null }>(
    `SELECT COUNT(*) AS c, COALESCE(MAX(UNIX_TIMESTAMP(updated_at)), 0) AS t
       FROM meeting_messages
      WHERE meeting_id = ? AND deleted_at IS NULL`,
    [meetingId]
  );

  return { count: Number(row?.c ?? 0), stamp: Number(row?.t ?? 0) };
}
