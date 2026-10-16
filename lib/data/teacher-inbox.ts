import "server-only";
import { query, queryOne } from "@/lib/db";
import { tablesExist, columnExists } from "@/lib/db/tables";

export const INBOX_TABLES = ["teacher_threads", "teacher_thread_messages"];

export async function inboxReady(): Promise<boolean> {
  return tablesExist(INBOX_TABLES);
}

export type Thread = {
  id: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  subject: string;
  status: "open" | "answered" | "closed";
  lastMessageAt: string;
  unread: boolean;
  /** The other side's name — the teacher's for a student, and vice versa. */
  withName: string;
};

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  authorName: string;
};

/** The student's own threads. */
export async function studentThreads(studentId: string): Promise<Thread[]> {
  if (!(await inboxReady())) return [];

  const rows = await query<{
    id: string; course_id: string; course_title: string; course_slug: string;
    subject: string; status: Thread["status"]; last_message_at: string;
    student_unread: number; teacher_name: string | null;
  }>(
    /* LEFT JOIN on courses: an admin thread has no course, and an
       inner join would hide every message from the platform. */
    `SELECT th.id, th.course_id, c.title AS course_title, c.slug AS course_slug,
            th.subject, th.status, th.last_message_at, th.student_unread,
            COALESCE(p.full_name, ap.full_name) AS teacher_name
       FROM teacher_threads th
       LEFT JOIN courses  c ON c.id = th.course_id
       LEFT JOIN teachers t ON t.id = th.teacher_id
       LEFT JOIN profiles p ON p.id = t.profile_id
       LEFT JOIN profiles ap ON ap.id = th.admin_id
      WHERE th.student_id = ?
      ORDER BY th.last_message_at DESC`,
    [studentId]
  );

  return rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    courseTitle: r.course_title ?? "الإدارة",
    courseSlug: r.course_slug ?? "",
    subject: r.subject,
    status: r.status,
    lastMessageAt: String(r.last_message_at),
    unread: Number(r.student_unread) === 1,
    withName: r.teacher_name ?? "—",
  }));
}

/**
 * The teacher's inbox, unanswered first.
 *
 * Keyed on the PROFILE id, not the teachers-row id: that is what a
 * session carries, and resolving it here means callers never have to
 * look the teacher row up themselves — one of them would eventually
 * look it up differently.
 */
export async function teacherThreads(profileId: string): Promise<Thread[]> {
  if (!(await inboxReady())) return [];

  const rows = await query<{
    id: string; course_id: string; course_title: string; course_slug: string;
    subject: string; status: Thread["status"]; last_message_at: string;
    teacher_unread: number; student_name: string | null;
  }>(
    `SELECT th.id, th.course_id, c.title AS course_title, c.slug AS course_slug,
            th.subject, th.status, th.last_message_at, th.teacher_unread,
            p.full_name AS student_name
       FROM teacher_threads th
       JOIN courses  c ON c.id = th.course_id
       LEFT JOIN profiles p ON p.id = th.student_id
       JOIN teachers tt ON tt.id = th.teacher_id
      WHERE tt.profile_id = ?
      ORDER BY th.teacher_unread DESC, th.last_message_at DESC`,
    [profileId]
  );

  return rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    courseTitle: r.course_title,
    courseSlug: r.course_slug,
    subject: r.subject,
    status: r.status,
    lastMessageAt: String(r.last_message_at),
    unread: Number(r.teacher_unread) === 1,
    withName: r.student_name ?? "—",
  }));
}

/**
 * One thread, only for the two people in it.
 *
 * The membership check is the WHERE clause, not a check afterwards: a
 * query that can return somebody else's conversation is one refactor
 * away from doing so.
 */
export async function threadFor(
  threadId: string,
  viewerId: string
): Promise<{ thread: Thread; messages: ThreadMessage[]; isTeacher: boolean } | null> {
  if (!(await inboxReady())) return null;

  const row = await queryOne<{
    id: string; course_id: string; course_title: string; course_slug: string;
    subject: string; status: Thread["status"]; last_message_at: string;
    student_id: string; teacher_profile_id: string | null; admin_id: string | null;
    student_name: string | null; teacher_name: string | null;
  }>(
    /*
      The membership test IS the WHERE clause — a query that can return
      somebody else's conversation is one refactor from doing so. An
      admin thread adds admin_id to the two who may read it.
    */
    `SELECT th.id, th.course_id, c.title AS course_title, c.slug AS course_slug,
            th.subject, th.status, th.last_message_at, th.student_id,
            t.profile_id AS teacher_profile_id, th.admin_id,
            sp.full_name AS student_name,
            COALESCE(tp.full_name, ap.full_name) AS teacher_name
       FROM teacher_threads th
       LEFT JOIN courses c ON c.id = th.course_id
       LEFT JOIN teachers t  ON t.id = th.teacher_id
       LEFT JOIN profiles tp ON tp.id = t.profile_id
       LEFT JOIN profiles ap ON ap.id = th.admin_id
       LEFT JOIN profiles sp ON sp.id = th.student_id
      WHERE th.id = ?
        AND (th.student_id = ? OR t.profile_id = ? OR th.admin_id = ?)
      LIMIT 1`,
    [threadId, viewerId, viewerId, viewerId]
  );
  if (!row) return null;

  /* "The other side" for an admin thread is the admin. */
  const isTeacher = row.teacher_profile_id === viewerId || row.admin_id === viewerId;

  const messages = await query<{
    id: string; body: string; created_at: string; author_id: string; author_name: string | null;
  }>(
    `SELECT m.id, m.body, m.created_at, m.author_id, p.full_name AS author_name
       FROM teacher_thread_messages m
       LEFT JOIN profiles p ON p.id = m.author_id
      WHERE m.thread_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC`,
    [threadId]
  );

  return {
    isTeacher,
    thread: {
      id: row.id,
      courseId: row.course_id,
      courseTitle: row.course_title ?? "الإدارة",
      courseSlug: row.course_slug ?? "",
      subject: row.subject,
      status: row.status,
      lastMessageAt: String(row.last_message_at),
      unread: false,
      withName: (isTeacher ? row.student_name : row.teacher_name) ?? "—",
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: String(m.created_at),
      mine: m.author_id === viewerId,
      authorName: m.author_name ?? "—",
    })),
  };
}

/** The open thread for this student on this course, if any. */
export async function openThreadFor(
  studentId: string,
  courseId: string
): Promise<string | null> {
  if (!(await inboxReady())) return null;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM teacher_threads
      WHERE student_id = ? AND course_id = ? AND open_key IS NOT NULL
      LIMIT 1`,
    [studentId, courseId]
  );
  return row?.id ?? null;
}

/** The admin's conversations with one student. */
export async function adminThreadsWith(studentId: string): Promise<Thread[]> {
  if (!(await inboxReady())) return [];
  if (!(await columnExists("teacher_threads", "kind"))) return [];

  const rows = await query<{
    id: string; subject: string; status: Thread["status"];
    last_message_at: string; teacher_unread: number; student_name: string | null;
  }>(
    `SELECT th.id, th.subject, th.status, th.last_message_at, th.teacher_unread,
            p.full_name AS student_name
       FROM teacher_threads th
       LEFT JOIN profiles p ON p.id = th.student_id
      WHERE th.student_id = ? AND th.kind = 'admin'
      ORDER BY th.last_message_at DESC`,
    [studentId]
  );

  return rows.map((r) => ({
    id: r.id,
    courseId: "",
    courseTitle: "الإدارة",
    courseSlug: "",
    subject: r.subject,
    status: r.status,
    lastMessageAt: String(r.last_message_at),
    unread: Number(r.teacher_unread) === 1,
    withName: r.student_name ?? "—",
  }));
}

export type Contact = {
  /** An existing thread, when there is one. */
  threadId: string | null;
  kind: "admin" | "teacher";
  name: string;
  avatarUrl: string | null;
  /** The course this teacher is reachable about. Null for the admin. */
  courseId: string | null;
  courseTitle: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: boolean;
};

/**
 * WHO THE STUDENT CAN WRITE TO.
 *
 * Not "threads they already have" — the list is the people, and a
 * conversation that has not started yet still needs a row to start it
 * from. Opening a chat app to an empty screen with no way to begin is
 * the thing this avoids.
 *
 * Two sources:
 *   - the platform, always present
 *   - the teacher of every course they are enrolled in
 *
 * Deduplicated by course: a teacher who teaches two of their courses
 * appears twice, once per course, because the question is usually
 * about a particular course.
 */
export async function studentContacts(studentId: string): Promise<Contact[]> {
  if (!(await inboxReady())) return [];
  const hasKind = await columnExists("teacher_threads", "kind");

  /* Every thread this student is in, newest message first. */
  const threads = await query<{
    id: string; kind: string | null; course_id: string | null;
    teacher_profile_id: string | null; last_message_at: string;
    student_unread: number; last_body: string | null;
  }>(
    `SELECT th.id, ${hasKind ? "th.kind" : "'teacher' AS kind"}, th.course_id,
            t.profile_id AS teacher_profile_id,
            th.last_message_at, th.student_unread,
            (SELECT m.body FROM teacher_thread_messages m
              WHERE m.thread_id = th.id AND m.deleted_at IS NULL
              ORDER BY m.created_at DESC LIMIT 1) AS last_body
       FROM teacher_threads th
       LEFT JOIN teachers t ON t.id = th.teacher_id
      WHERE th.student_id = ?
      ORDER BY th.last_message_at DESC`,
    [studentId]
  );

  /* The teacher of each enrolled course. */
  const teachers = await query<{
    course_id: string; course_title: string;
    profile_id: string | null; full_name: string | null; avatar_url: string | null;
  }>(
    `SELECT DISTINCT c.id AS course_id, c.title AS course_title,
            p.id AS profile_id, p.full_name, p.avatar_url
       FROM enrollments e
       JOIN courses c   ON c.id = e.course_id AND c.deleted_at IS NULL
       JOIN teachers t  ON t.id = c.teacher_id
       JOIN profiles p  ON p.id = t.profile_id
      WHERE e.user_id = ? AND e.deleted_at IS NULL
        AND e.starts_at <= UTC_TIMESTAMP(3)
        AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
      ORDER BY c.title`,
    [studentId]
  );

  const contacts: Contact[] = [];

  /* The platform first, always — it is the one everybody can reach. */
  const adminThread = threads.find((t) => t.kind === "admin");
  contacts.push({
    threadId: adminThread?.id ?? null,
    kind: "admin",
    name: "إدارة تبيان",
    avatarUrl: null,
    courseId: null,
    courseTitle: null,
    lastMessage: adminThread?.last_body ?? null,
    lastMessageAt: adminThread ? String(adminThread.last_message_at) : null,
    unread: Number(adminThread?.student_unread ?? 0) === 1,
  });

  for (const teacher of teachers) {
    const thread = threads.find(
      (t) => t.kind !== "admin" && t.course_id === teacher.course_id
    );
    contacts.push({
      threadId: thread?.id ?? null,
      kind: "teacher",
      name: teacher.full_name ?? "الأستاذ",
      avatarUrl: teacher.avatar_url,
      courseId: teacher.course_id,
      courseTitle: teacher.course_title,
      lastMessage: thread?.last_body ?? null,
      lastMessageAt: thread ? String(thread.last_message_at) : null,
      unread: Number(thread?.student_unread ?? 0) === 1,
    });
  }

  return contacts;
}

/** How many conversations have something the student has not read. */
export async function studentUnreadMessages(studentId: string): Promise<number> {
  if (!(await inboxReady())) return 0;
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM teacher_threads
      WHERE student_id = ? AND student_unread = 1`,
    [studentId]
  );
  return Number(row?.n ?? 0);
}

export type AdminConversation = {
  threadId: string;
  studentId: string;
  studentName: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: boolean;
};

/**
 * Every conversation the platform has with a student.
 *
 * Unanswered first, then newest — an admin opening this page wants
 * the list of people waiting, not a diary. The per-student page still
 * shows that student's own threads; this is the view that stops one
 * of them being missed because nobody opened that student's page.
 */
export async function adminInbox(): Promise<AdminConversation[]> {
  if (!(await inboxReady())) return [];
  if (!(await columnExists("teacher_threads", "kind"))) return [];

  const rows = await query<{
    id: string; student_id: string; full_name: string | null; avatar_url: string | null;
    last_message_at: string; teacher_unread: number; last_body: string | null;
  }>(
    `SELECT th.id, th.student_id, p.full_name, p.avatar_url,
            th.last_message_at, th.teacher_unread,
            (SELECT m.body FROM teacher_thread_messages m
              WHERE m.thread_id = th.id AND m.deleted_at IS NULL
              ORDER BY m.created_at DESC LIMIT 1) AS last_body
       FROM teacher_threads th
       LEFT JOIN profiles p ON p.id = th.student_id
      WHERE th.kind = 'admin'
      ORDER BY th.teacher_unread DESC, th.last_message_at DESC`
  );

  return rows.map((r) => ({
    threadId: r.id,
    studentId: r.student_id,
    studentName: r.full_name ?? "—",
    avatarUrl: r.avatar_url,
    lastMessage: r.last_body,
    lastMessageAt: String(r.last_message_at),
    unread: Number(r.teacher_unread) === 1,
  }));
}

/** How many conversations are waiting on the platform to answer. */
export async function adminUnreadCount(): Promise<number> {
  if (!(await inboxReady())) return 0;
  if (!(await columnExists("teacher_threads", "kind"))) return 0;
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM teacher_threads WHERE kind = 'admin' AND teacher_unread = 1`
  );
  return Number(row?.n ?? 0);
}
