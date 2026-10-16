"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { inboxReady, openThreadFor } from "@/lib/data/teacher-inbox";
import { notify } from "@/lib/notify";

export type InboxState = { error: string | null; threadId?: string };

const MAX_BODY = 4000;

/**
 * Opens a private question to the course's teacher.
 *
 * THREE GATES, and they are the feature rather than decoration. The
 * public questions under each lesson are better for everyone — the
 * answer stays where the next student will read it, and the teacher
 * writes it once — so this channel is deliberately narrow:
 *
 *   1. enrolled students only
 *   2. one open thread per course; the previous one must be answered
 *      or closed first
 *   3. reached from the teacher's card on the course page, not from
 *      beside the public questions
 *
 * Gate 2 is enforced by a unique index as well as by this check (see
 * migration 21): two rapid submits would otherwise both pass the read
 * and both insert.
 */
export async function openThreadAction(
  courseId: string,
  _prev: InboxState,
  formData: FormData
): Promise<InboxState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول أولاً" };
  if (!(await inboxReady())) {
    return { error: "شغّل ملفّ 21-teacher-inbox.sql في phpMyAdmin أولاً." };
  }

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 191);
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_BODY);
  if (!subject) return { error: "اكتب عنوان السؤال" };
  if (!body) return { error: "اكتب سؤالك" };

  /* Enrolled, and the course actually has a teacher to ask. */
  const course = await queryOne<{ teacher_id: string | null }>(
    `SELECT c.teacher_id
       FROM courses c
      WHERE c.id = ? AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM enrollments e
           WHERE e.user_id = ? AND e.course_id = c.id
             AND e.deleted_at IS NULL
             AND e.starts_at <= UTC_TIMESTAMP(3)
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
        )
      LIMIT 1`,
    [courseId, user.id]
  );
  if (!course) return { error: "هذه الميزة للمسجَّلين في الدورة فقط" };
  if (!course.teacher_id) return { error: "لا يوجد أستاذ مرتبط بهذه الدورة" };

  const already = await openThreadFor(user.id, courseId);
  if (already) return { error: "لديك سؤال مفتوح في هذه الدورة — أكمل فيه", threadId: already };

  const threadId = newId();
  try {
    await execute(
      `INSERT INTO teacher_threads
         (id, course_id, teacher_id, student_id, subject, status, teacher_unread)
       VALUES (?, ?, ?, ?, ?, 'open', 1)`,
      [threadId, courseId, course.teacher_id, user.id, subject]
    );
  } catch {
    /* The unique index caught a second submit. */
    const open = await openThreadFor(user.id, courseId);
    return { error: "لديك سؤال مفتوح في هذه الدورة", threadId: open ?? undefined };
  }

  await execute(
    `INSERT INTO teacher_thread_messages (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)`,
    [newId(), threadId, user.id, body]
  );

  /* The teacher is the only person who can answer it, so they are the
     one who has to be told. */
  const teacherProfile = await queryOne<{ profile_id: string }>(
    `SELECT profile_id FROM teachers WHERE id = ? LIMIT 1`,
    [course.teacher_id]
  );
  if (teacherProfile) {
    await notify({
      userId: teacherProfile.profile_id,
      type: "comment_reply",
      title: "سؤال خاصّ جديد",
      body: subject,
      entityType: "thread",
      entityId: threadId,
    });
  }

  revalidatePath("/dashboard/messages");
  revalidatePath("/teacher/questions");
  return { error: null, threadId };
}

/**
 * A reply from either side.
 *
 * Who may reply is decided by the same WHERE clause that finds the
 * thread — a membership test written once cannot disagree with itself.
 * A teacher's reply marks the thread answered, which is also what
 * frees the student to open a new one.
 */
export async function replyThreadAction(
  threadId: string,
  _prev: InboxState,
  formData: FormData
): Promise<InboxState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول أولاً" };

  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_BODY);
  if (!body) return { error: "اكتب رسالتك" };

  const thread = await queryOne<{
    id: string; student_id: string; teacher_profile_id: string | null; admin_id: string | null;
  }>(
    `SELECT th.id, th.student_id, t.profile_id AS teacher_profile_id, th.admin_id
       FROM teacher_threads th
       LEFT JOIN teachers t ON t.id = th.teacher_id
      WHERE th.id = ?
        AND (th.student_id = ? OR t.profile_id = ? OR th.admin_id = ?)
      LIMIT 1`,
    [threadId, user.id, user.id, user.id]
  );
  if (!thread) return { error: "غير موجود" };

  /* The admin plays the same role as the teacher in an admin thread:
     the side that answers, and whose reply marks it answered. */
  const fromTeacher =
    thread.teacher_profile_id === user.id || thread.admin_id === user.id;

  await execute(
    `INSERT INTO teacher_thread_messages (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)`,
    [newId(), threadId, user.id, body]
  );

  await execute(
    `UPDATE teacher_threads
        SET last_message_at = UTC_TIMESTAMP(3),
            status = ?,
            student_unread = ?,
            teacher_unread = ?
      WHERE id = ?`,
    [fromTeacher ? "answered" : "open", fromTeacher ? 1 : 0, fromTeacher ? 0 : 1, threadId]
  );

  /* The other side gets a bell entry — a private question answered on
     a page nobody is watching is a question that looks unanswered. */
  const other = fromTeacher
    ? thread.student_id
    : thread.teacher_profile_id ?? thread.admin_id;
  if (other && other !== user.id) {
    await notify({
      userId: other,
      type: fromTeacher ? "question_answered" : "comment_reply",
      title: fromTeacher ? "أجاب الأستاذ على سؤالك" : "سؤال جديد من طالب",
      entityType: "thread",
      entityId: threadId,
    });
  }

  revalidatePath("/dashboard/messages");
  revalidatePath(`/teacher/questions/${threadId}`);
  return { error: null, threadId };
}

/** Closing frees the student to ask again. Either side may close. */
export async function closeThreadAction(threadId: string): Promise<InboxState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول أولاً" };

  const affected = await execute(
    `UPDATE teacher_threads th
       LEFT JOIN teachers t ON t.id = th.teacher_id
        SET th.status = 'closed', th.open_key = NULL
      WHERE th.id = ?
        AND (th.student_id = ? OR t.profile_id = ? OR th.admin_id = ?)`,
    [threadId, user.id, user.id, user.id]
  );
  void affected;

  revalidatePath("/dashboard/messages");
  revalidatePath("/teacher/questions");
  return { error: null, threadId };
}

/** Marks the viewer's side read when they open it. */
export async function markThreadReadAction(threadId: string, asTeacher: boolean): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await execute(
    asTeacher
      ? `UPDATE teacher_threads th LEFT JOIN teachers t ON t.id = th.teacher_id
            SET th.teacher_unread = 0 WHERE th.id = ? AND t.profile_id = ?`
      : `UPDATE teacher_threads SET student_unread = 0 WHERE id = ? AND student_id = ?`,
    [threadId, user.id]
  );
}
