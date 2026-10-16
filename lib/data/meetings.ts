import "server-only";
import { randomBytes } from "node:crypto";
import { query, queryOne, execute, newId, toSql } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { hasActiveEnrollment, isAdmin } from "@/lib/db/guard";
import { tablesExist, MEETING_TABLES } from "@/lib/db/tables";

/**
 * Live sessions: scheduling, eligibility, and attendance.
 *
 * The video itself is not this server's business — see
 * tibyan-db/mysql/04-meetings.sql for why it cannot be. What IS this
 * server's business is deciding who is allowed into a room, and that
 * decision is made here and nowhere else.
 */

export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";

export type Meeting = {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  academic_year_id: string | null;
  teacher_id: string | null;
  room_name: string;
  /** "event:<id>[:<hash>]" or "video:<id>[:<hash>]" — null until the
   *  teacher attaches the Vimeo link. See lib/video/extract-vimeo-event. */
  stream_source: string | null;
  starts_at: string;
  duration_minutes: number;
  status: MeetingStatus;
  recording_url: string | null;
};

export type MeetingWithContext = Meeting & {
  course_title: string | null;
  course_slug: string | null;
  year_name_ar: string | null;
  year_name_en: string | null;
  teacher_name: string | null;
};

/**
 * A room name nobody can guess.
 *
 * Kept for the sessions created before the move to Vimeo, whose rows
 * still carry one, and still generated so no row has an empty column.
 * It no longer opens anything: the broadcast is `stream_source`.
 *
 * It was the entry secret in the Jitsi days — whoever held it could
 * walk in from jit.si without touching this platform — which is why it
 * is 32 random hex characters and never the title.
 */
export function newRoomName(): string {
  return `tibyan-${randomBytes(16).toString("hex")}`;
}

/** How long a session stays joinable, in minutes, around its start. */
const EARLY_JOIN_MINUTES = 15;
const GRACE_AFTER_END_MINUTES = 30;

/**
 * Whether a session is open right now.
 *
 * Students may arrive a quarter of an hour early — a room that refuses
 * them until the exact second is a room full of people refreshing — and
 * the door stays open past the scheduled end, because sessions overrun.
 */
export function joinWindow(m: Pick<Meeting, "starts_at" | "duration_minutes" | "status">): {
  opensAt: Date;
  closesAt: Date;
  isOpen: boolean;
} {
  const start = new Date(`${m.starts_at.replace(" ", "T")}Z`);
  const opensAt = new Date(start.getTime() - EARLY_JOIN_MINUTES * 60_000);
  const closesAt = new Date(
    start.getTime() + (m.duration_minutes + GRACE_AFTER_END_MINUTES) * 60_000
  );
  const now = new Date();
  const isOpen =
    m.status !== "cancelled" && m.status !== "ended" && now >= opensAt && now <= closesAt;
  return { opensAt, closesAt, isOpen };
}

const SELECT_WITH_CONTEXT = `
  SELECT m.id, m.title, m.description, m.course_id, m.academic_year_id, m.teacher_id,
         m.room_name, m.stream_source, m.starts_at, m.duration_minutes, m.status, m.recording_url,
         c.title AS course_title, c.slug AS course_slug,
         y.name_ar AS year_name_ar, y.name_en AS year_name_en,
         p.full_name AS teacher_name
    FROM meetings m
    LEFT JOIN courses c         ON c.id = m.course_id
    LEFT JOIN academic_years y  ON y.id = m.academic_year_id
    LEFT JOIN teachers t        ON t.id = m.teacher_id
    LEFT JOIN profiles p        ON p.id = t.profile_id
   WHERE m.deleted_at IS NULL`;

/**
 * May this user attend this session?
 *
 * Admins always may. A teacher hosting it always may. Otherwise the
 * session's scope decides: an enrolment in its course, or membership of
 * its academic year.
 *
 * Note what is NOT accepted: a session with neither scope set. Such a
 * row should not exist (the create action refuses it), but if one ever
 * did, the safe reading of "no audience defined" is nobody — not
 * everybody.
 */
export async function canAttend(meeting: Meeting, user: SessionUser): Promise<boolean> {
  if (await isAdmin()) return true;

  if (meeting.teacher_id) {
    const owns = await queryOne<{ ok: number }>(
      `SELECT 1 AS ok FROM teachers WHERE id = ? AND profile_id = ? LIMIT 1`,
      [meeting.teacher_id, user.id]
    );
    if (owns) return true;
  }

  if (meeting.course_id) {
    return hasActiveEnrollment(user.id, meeting.course_id);
  }

  if (meeting.academic_year_id) {
    const row = await queryOne<{ ok: number }>(
      `SELECT 1 AS ok
         FROM profiles
        WHERE id = ? AND academic_year_id = ? AND deleted_at IS NULL
        LIMIT 1`,
      [user.id, meeting.academic_year_id]
    );
    return row !== null;
  }

  return false;
}

/** Whether this user hosts the session — decides moderator rights. */
export async function isHost(meeting: Meeting, user: SessionUser): Promise<boolean> {
  if (await isAdmin()) return true;
  if (!meeting.teacher_id) return false;
  const row = await queryOne<{ ok: number }>(
    `SELECT 1 AS ok FROM teachers WHERE id = ? AND profile_id = ? LIMIT 1`,
    [meeting.teacher_id, user.id]
  );
  return row !== null;
}

export async function meetingsReady(): Promise<boolean> {
  return tablesExist(MEETING_TABLES);
}

export async function getMeeting(id: string): Promise<MeetingWithContext | null> {
  if (!(await tablesExist(MEETING_TABLES))) return null;

  return queryOne<MeetingWithContext>(`${SELECT_WITH_CONTEXT} AND m.id = ? LIMIT 1`, [id]);
}

/**
 * The sessions THIS student can attend, soonest first.
 *
 * Scoped in SQL rather than fetched-then-filtered: a student must never
 * receive the row of a session they cannot attend, because the row
 * carries `room_name` — the very secret that grants entry.
 */
export async function listMeetingsForStudent(limit = 20): Promise<MeetingWithContext[]> {
  if (!(await tablesExist(MEETING_TABLES))) return [];

  const user = await getSessionUser();
  if (!user) return [];

  return query<MeetingWithContext>(
    `${SELECT_WITH_CONTEXT}
       AND m.status <> 'cancelled'
       AND m.starts_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 HOUR)
       AND (
             (m.course_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM enrollments e
                 WHERE e.user_id = ? AND e.course_id = m.course_id
                   AND e.deleted_at IS NULL
                   AND e.starts_at <= UTC_TIMESTAMP(3)
                   AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))))
          OR (m.academic_year_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM profiles pr
                 WHERE pr.id = ? AND pr.academic_year_id = m.academic_year_id
                   AND pr.deleted_at IS NULL))
           )
     ORDER BY m.starts_at ASC
     LIMIT ?`,
    [user.id, user.id, limit]
  );
}

/** Every session, for the admin list. */
export async function listMeetingsForAdmin(limit = 100): Promise<MeetingWithContext[]> {
  if (!(await tablesExist(MEETING_TABLES))) return [];

  return query<MeetingWithContext>(
    `${SELECT_WITH_CONTEXT} ORDER BY m.starts_at DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Records that a user is in the room, and keeps their present-time.
 *
 * Called repeatedly while the session runs. `seconds_present` is
 * accumulated from the gap since we last heard from this user, and only
 * when that gap is short enough to mean they were really there — a
 * student who closes the tab and returns an hour later adds nothing for
 * the hour they were away.
 */
const HEARTBEAT_GRACE_SECONDS = 180;

export async function recordAttendance(meetingId: string, userId: string): Promise<void> {
  const existing = await queryOne<{ id: string; last_seen_at: string }>(
    `SELECT id, last_seen_at FROM meeting_attendance WHERE meeting_id = ? AND user_id = ? LIMIT 1`,
    [meetingId, userId]
  );

  if (!existing) {
    await execute(
      `INSERT INTO meeting_attendance (id, meeting_id, user_id, first_joined_at, last_seen_at, seconds_present)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 0)`,
      [newId(), meetingId, userId]
    );
    return;
  }

  const last = new Date(`${existing.last_seen_at.replace(" ", "T")}Z`).getTime();
  const gapSeconds = Math.floor((Date.now() - last) / 1000);
  const credited = gapSeconds > 0 && gapSeconds <= HEARTBEAT_GRACE_SECONDS ? gapSeconds : 0;

  await execute(
    `UPDATE meeting_attendance
        SET last_seen_at = UTC_TIMESTAMP(3),
            seconds_present = seconds_present + ?
      WHERE id = ?`,
    [credited, existing.id]
  );
}

export type AttendanceRow = {
  user_id: string;
  full_name: string;
  first_joined_at: string;
  seconds_present: number;
};

export async function listAttendance(meetingId: string): Promise<AttendanceRow[]> {
  if (!(await tablesExist(MEETING_TABLES))) return [];

  return query<AttendanceRow>(
    `SELECT a.user_id, p.full_name, a.first_joined_at, a.seconds_present
       FROM meeting_attendance a
       JOIN profiles p ON p.id = a.user_id
      WHERE a.meeting_id = ?
      ORDER BY a.first_joined_at ASC`,
    [meetingId]
  );
}

export { toSql };
