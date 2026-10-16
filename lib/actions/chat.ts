"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { inboxReady } from "@/lib/data/teacher-inbox";
import { columnExists } from "@/lib/db/tables";
import { notify } from "@/lib/notify";

export type ChatState = { error: string | null; threadId?: string };

const MAX_BODY = 4000;

/**
 * Send a message to the platform, or to the teacher of one course.
 *
 * FINDS OR CREATES. A chat has no "start a conversation" step — the
 * student picks who to write to and writes. The thread is an
 * implementation detail they should never have to create.
 *
 * Replaces the old openThreadAction, which asked for a subject first
 * and refused a second question until the first was answered. That was
 * right when this was a narrow escape hatch beside the public
 * questions; it is wrong for a messages page, where being unable to
 * write a second line until someone replies is simply broken.
 */
export async function sendMessageAction(
  /** null = the platform; otherwise the teacher of this course. */
  courseId: string | null,
  _prev: ChatState,
  formData: FormData
): Promise<ChatState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول أولاً" };
  if (!(await inboxReady())) {
    return { error: "شغّل ملفّ 21-teacher-inbox.sql في phpMyAdmin أولاً." };
  }
  if (!(await columnExists("teacher_threads", "kind"))) {
    return { error: "شغّل ملفّ 23-admin-chat.sql في phpMyAdmin أولاً." };
  }

  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_BODY);
  if (!body) return { error: "اكتب رسالتك" };

  let teacherId: string | null = null;
  if (courseId) {
    /* Enrolled, and the course has a teacher to write to. The check is
       the query: a student who is not enrolled matches no row. */
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
    if (!course?.teacher_id) return { error: "لا يمكنك مراسلة هذا الأستاذ" };
    teacherId = course.teacher_id;
  }

  /* The open thread for this contact, or a new one. */
  const existing = await queryOne<{ id: string }>(
    courseId
      ? `SELECT id FROM teacher_threads
          WHERE student_id = ? AND course_id = ? AND kind = 'teacher' AND open_key IS NOT NULL
          LIMIT 1`
      : `SELECT id FROM teacher_threads
          WHERE student_id = ? AND kind = 'admin' AND open_key IS NOT NULL
          LIMIT 1`,
    courseId ? [user.id, courseId] : [user.id]
  );

  let threadId = existing?.id ?? null;

  if (!threadId) {
    threadId = newId();
    await execute(
      `INSERT INTO teacher_threads
         (id, course_id, teacher_id, student_id, kind, subject, status, teacher_unread)
       VALUES (?, ?, ?, ?, ?, ?, 'open', 1)`,
      [
        threadId,
        courseId,
        teacherId,
        user.id,
        courseId ? "teacher" : "admin",
        /* The first line stands in for a subject — the composer no
           longer asks for one, and an empty column helps nobody. */
        body.slice(0, 120),
      ]
    );
  }

  await execute(
    `INSERT INTO teacher_thread_messages (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)`,
    [newId(), threadId, user.id, body]
  );

  await execute(
    `UPDATE teacher_threads
        SET last_message_at = UTC_TIMESTAMP(3), status = 'open',
            teacher_unread = 1, student_unread = 0
      WHERE id = ?`,
    [threadId]
  );

  /* Tell whoever has to answer. */
  if (teacherId) {
    const t = await queryOne<{ profile_id: string }>(
      `SELECT profile_id FROM teachers WHERE id = ? LIMIT 1`,
      [teacherId]
    );
    if (t) {
      await notify({
        userId: t.profile_id,
        type: "comment_reply",
        title: "رسالة جديدة من طالب",
        body: body.slice(0, 120),
        entityType: "thread",
        entityId: threadId,
      });
    }
  }

  revalidatePath("/dashboard/messages");
  revalidatePath("/teacher/questions");
  return { error: null, threadId };
}
