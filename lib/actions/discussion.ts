"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notify";

export type DiscussionActionState = { error: string | null; success?: string | null };

/**
 * Lesson discussion.
 *
 * This file leaned on RLS more heavily than any other in the app. Four
 * of its actions wrote with nothing but `.eq("id", …)` and a comment
 * explaining that comments_update_own_or_admin scoped the statement to
 * the caller's own row "regardless of the id supplied here". With the
 * policies gone, those statements would have let any signed-in person
 * edit or delete anybody's comment by passing its id.
 *
 * Every write below therefore carries its own ownership test, and the
 * shape is deliberately uniform: the WHERE clause names the row AND the
 * owner, so a mismatch updates zero rows instead of the wrong one. Admins
 * get an explicit OR rather than a separate code path, because two paths
 * to the same write is how one of them ends up missing a check.
 */

export async function addCommentAction(
  lessonId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "الرجاء كتابة سؤالك أو تعليقك" };

  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    // user_id comes from the session, never the client, so the row can
    // only ever be owned by whoever posted it.
    await execute(`INSERT INTO comments (id, lesson_id, user_id, body) VALUES (?, ?, ?, ?)`, [
      newId(),
      lessonId,
      user.id,
      body,
    ]);
  } catch {
    return { error: "تعذّر إرسال التعليق" };
  }

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

/**
 * Any signed-in user may reply — student-to-student discussion is
 * allowed. The UI badges a reply as "الأستاذ" or "الإدارة" when the
 * author is the owning teacher or an admin; that is presentation, and
 * DiscussionPanel.tsx derives it from the role on the row.
 */
export async function addReplyAction(
  commentId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "الرجاء كتابة الرد" };

  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    await execute(
      `INSERT INTO comment_replies (id, comment_id, user_id, body) VALUES (?, ?, ?, ?)`,
      [newId(), commentId, user.id, body]
    );
  } catch {
    return { error: "تعذّر إرسال الرد" };
  }

  /*
    Tell whoever asked. Without this the reply lands on a page they
    have already left, and they find it only if they happen to come
    back — which is why the bell was always empty.

    Not told when they answer themselves, and never allowed to fail the
    reply that already succeeded (see lib/notify.ts).
  */
  const asker = await queryOne<{ user_id: string; lesson_title: string | null }>(
    `SELECT c.user_id, l.title AS lesson_title
       FROM comments c
       LEFT JOIN lessons l ON l.id = c.lesson_id
      WHERE c.id = ? LIMIT 1`,
    [commentId]
  );
  if (asker && asker.user_id !== user.id) {
    await notify({
      userId: asker.user_id,
      type: "comment_reply",
      title: "ردّ جديد على سؤالك",
      body: asker.lesson_title ? `في درس: ${asker.lesson_title}` : null,
      entityType: "course",
      entityId: courseSlug,
    });
  }

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

export async function editCommentAction(
  commentId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "لا يمكن حفظ تعليق فارغ" };

  return writeOwned(
    `UPDATE comments SET body = ? WHERE id = ? AND deleted_at IS NULL`,
    [body],
    commentId,
    courseSlug,
    "تعذّر حفظ التعديل"
  );
}

export async function deleteCommentAction(commentId: string, courseSlug: string) {
  // Soft delete, as before: the row stays so replies beneath it keep
  // their parent, and moderation history is not rewritten.
  return writeOwned(
    `UPDATE comments SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL`,
    [],
    commentId,
    courseSlug,
    "تعذّر حذف التعليق"
  );
}

export async function editReplyAction(
  replyId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "لا يمكن حفظ رد فارغ" };

  return writeOwned(
    `UPDATE comment_replies SET body = ? WHERE id = ? AND deleted_at IS NULL`,
    [body],
    replyId,
    courseSlug,
    "تعذّر حفظ التعديل",
    "comment_replies"
  );
}

export async function deleteReplyAction(replyId: string, courseSlug: string) {
  return writeOwned(
    `UPDATE comment_replies SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL`,
    [],
    replyId,
    courseSlug,
    "تعذّر حذف الرد",
    "comment_replies"
  );
}

/**
 * The shared owner-or-admin write.
 *
 * `sql` must end with `WHERE id = ?` plus whatever else; the owner test
 * is appended here so no caller can forget it. The row is read first so
 * that "not yours" and "does not exist" can be told apart for the error
 * message, but the UPDATE repeats the condition rather than trusting the
 * read — between the two statements is exactly where a check that only
 * ran once would be bypassed.
 */
async function writeOwned(
  sql: string,
  leadingArgs: (string | number)[],
  rowId: string,
  courseSlug: string,
  failureMessage: string,
  table: "comments" | "comment_replies" = "comments"
): Promise<DiscussionActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    const row = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
      [rowId]
    );
    if (!row) return { error: failureMessage };
    if (row.user_id !== user.id && user.role !== "admin") {
      return { error: "لا تملك صلاحية تعديل هذا المحتوى" };
    }

    const ownerClause = user.role === "admin" ? "" : " AND user_id = ?";
    const ownerArgs = user.role === "admin" ? [] : [user.id];

    await execute(sql + ownerClause, [...leadingArgs, rowId, ...ownerArgs]);
  } catch {
    return { error: failureMessage };
  }

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

/**
 * Reporting a comment.
 *
 * uq_content_reports_pending_reporter_target (0019) was a PARTIAL unique
 * index — one pending report per reporter per target — and MariaDB has
 * no partial indexes, so the schema carries no equivalent key and there
 * is no duplicate-key error to catch. The check is done by reading
 * first.
 *
 * Two people reporting at the same instant can still both get a row in.
 * That was true of the old code's error path too, and a duplicate report
 * costs a moderator one extra click rather than anything worse.
 */
export async function reportCommentAction(
  commentId: string,
  _courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "الرجاء ذكر سبب الإبلاغ" };

  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    const pending = await queryOne<{ id: string }>(
      `SELECT id FROM content_reports
        WHERE reporter_id = ? AND target_type = 'comment' AND target_id = ?
          AND status = 'pending'`,
      [user.id, commentId]
    );

    if (pending) {
      return { error: null, success: "لديك بلاغ قيد المراجعة على هذا التعليق بالفعل" };
    }

    await execute(
      `INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason)
       VALUES (?, ?, 'comment', ?, ?)`,
      [newId(), user.id, commentId, reason]
    );
  } catch {
    return { error: "تعذّر إرسال البلاغ" };
  }

  return { error: null, success: "تم إرسال البلاغ، شكراً لك" };
}

/**
 * Pin or unpin a comment.
 *
 * Was the pin_comment() SECURITY DEFINER function, backed by
 * trg_comments_prevent_pin_bypass (0021) which re-verified the caller
 * independently — two layers, because pinning is how a teacher marks the
 * authoritative answer in a thread and a student who could pin their own
 * comment could present a wrong answer as endorsed.
 *
 * Both layers were in the database. This is the replacement, and it is
 * the only one: admin, or the teacher who owns the course this comment's
 * lesson belongs to. The join walks comment → lesson → section → course
 * → teacher → profile, and it is `t.profile_id` that identifies the
 * person, not `c.teacher_id`.
 */
export async function togglePinCommentAction(
  commentId: string,
  courseSlug: string,
  nextValue: boolean
) {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    if (user.role !== "admin") {
      const owns = await queryOne<{ ok: number }>(
        `SELECT 1 AS ok
           FROM comments cm
           JOIN lessons l         ON l.id = cm.lesson_id
           JOIN course_sections s ON s.id = l.section_id
           JOIN courses c         ON c.id = s.course_id
           JOIN teachers t        ON t.id = c.teacher_id
          WHERE cm.id = ? AND t.profile_id = ?
          LIMIT 1`,
        [commentId, user.id]
      );
      if (!owns) return { error: "لا تملك صلاحية تثبيت هذا التعليق" };
    }

    await execute(`UPDATE comments SET is_pinned = ? WHERE id = ?`, [nextValue ? 1 : 0, commentId]);
  } catch {
    return { error: "لا تملك صلاحية تثبيت هذا التعليق" };
  }

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}
