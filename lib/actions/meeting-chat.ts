"use server";

import { execute, newId } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/db/guard";
import { getMeeting, canAttend, isHost } from "@/lib/data/meetings";
import { messagesVersion, listMessages, getMessage, type MeetingThread } from "@/lib/data/meeting-chat";
import { getDictionary } from "@/lib/i18n/locale";

export type ChatResult =
  | { ok: true; messages: MeetingThread[] }
  | { ok: false; error: string };

const MAX_LENGTH = 2000;

/**
 * Everything that writes to a session's discussion.
 *
 * ONE RULE, APPLIED EVERY TIME: whoever may be in the room may read and
 * write; nobody else. That is `canAttend`, the same check the room page
 * makes — re-asked on every call rather than trusted from the page
 * load, because an enrolment can lapse between opening the page and
 * typing into it, and because an action is reachable directly without
 * ever rendering that page.
 */
async function gate(meetingId: string) {
  const user = await getSessionUser();
  if (!user) return { user: null, meeting: null } as const;

  const meeting = await getMeeting(meetingId);
  if (!meeting) return { user, meeting: null } as const;

  if (!(await canAttend(meeting, user))) return { user, meeting: null } as const;
  return { user, meeting } as const;
}

/**
 * The poll's first question: has anything changed?
 *
 * Runs on the same access gate as the fetch below — a marker still
 * leaks "this meeting has N messages" to anyone who can call it, which
 * is exactly the kind of small leak that is easy to forget when adding
 * a fast path beside a guarded one.
 *
 * See messagesVersion() in lib/data/meeting-chat.ts for why this
 * exists at all.
 */
export async function fetchMeetingChatVersionAction(
  meetingId: string
): Promise<{ ok: boolean; count?: number; stamp?: number }> {
  const { meeting } = await gate(meetingId);
  if (!meeting) return { ok: false };

  return { ok: true, ...(await messagesVersion(meetingId)) };
}

/** The current messages — fetched on open, and only when the version moves. */
export async function fetchMeetingMessagesAction(meetingId: string): Promise<ChatResult> {
  const { dict } = await getDictionary();
  const { meeting } = await gate(meetingId);
  if (!meeting) return { ok: false, error: dict.meetings.notAllowed };

  return { ok: true, messages: await listMessages(meetingId) };
}

export async function postMeetingMessageAction(
  meetingId: string,
  body: string,
  replyToId?: string
): Promise<ChatResult> {
  const { dict } = await getDictionary();
  const t = dict.meetingChat;

  const { user, meeting } = await gate(meetingId);
  if (!user || !meeting) return { ok: false, error: dict.meetings.notAllowed };

  const text = body.trim();
  if (!text) return { ok: false, error: t.errEmpty };
  if (text.length > MAX_LENGTH) return { ok: false, error: t.errTooLong };

  /*
    A reply must belong to THIS session. Without the check, a crafted
    call could hang a reply off a message in a session the writer cannot
    open — and that reply would then render inside it.
  */
  let parent: string | null = null;
  if (replyToId) {
    const target = await getMessage(replyToId);
    if (!target || target.meeting_id !== meetingId) return { ok: false, error: t.errReply };
    parent = target.id;
  }

  await execute(
    `INSERT INTO meeting_messages (id, meeting_id, user_id, body, reply_to_id) VALUES (?, ?, ?, ?, ?)`,
    [newId(), meetingId, user.id, text, parent]
  );

  return { ok: true, messages: await listMessages(meetingId) };
}

export async function deleteMeetingMessageAction(messageId: string): Promise<ChatResult> {
  const { dict } = await getDictionary();

  const user = await getSessionUser();
  if (!user) return { ok: false, error: dict.meetings.notAllowed };

  const message = await getMessage(messageId);
  if (!message) return { ok: false, error: dict.meetings.notAllowed };

  const { meeting } = await gate(message.meeting_id);
  if (!meeting) return { ok: false, error: dict.meetings.notAllowed };

  /*
    Your own message, or the host's room. Filtering by id alone —
    `WHERE id = ?` with no owner clause — is how a delete button becomes
    a way to erase anyone's message, and it is a mistake this codebase
    has already made once in the lesson comments.
  */
  const mayDelete = message.user_id === user.id || (await isHost(meeting, user)) || (await isAdmin());
  if (!mayDelete) return { ok: false, error: dict.meetings.notAllowed };

  await execute(
    `UPDATE meeting_messages SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL`,
    [messageId]
  );

  return { ok: true, messages: await listMessages(message.meeting_id) };
}

export async function togglePinMeetingMessageAction(messageId: string): Promise<ChatResult> {
  const { dict } = await getDictionary();

  const user = await getSessionUser();
  if (!user) return { ok: false, error: dict.meetings.notAllowed };

  const message = await getMessage(messageId);
  if (!message) return { ok: false, error: dict.meetings.notAllowed };

  const { meeting } = await gate(message.meeting_id);
  if (!meeting) return { ok: false, error: dict.meetings.notAllowed };

  /* Pinning is the host's voice, not a student's. */
  if (!(await isHost(meeting, user))) return { ok: false, error: dict.meetings.notAllowed };

  await execute(
    `UPDATE meeting_messages SET is_pinned = 1 - is_pinned WHERE id = ?`,
    [messageId]
  );

  return { ok: true, messages: await listMessages(message.meeting_id) };
}
