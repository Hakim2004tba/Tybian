"use server";

import { revalidatePath } from "next/cache";
import { requireRouteAccess } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendCampaignEmail } from "@/lib/mail";
import { execute, newId } from "@/lib/db";
import { columnExists } from "@/lib/db/tables";
import { getSessionUser } from "@/lib/auth/session";

export type MessageState = { error: string | null; success?: string | null };

/**
 * One message to one student, from the admin.
 *
 * IT OPENS A CONVERSATION, not a announcement. The first version only
 * wrote a notification and sent an email, which left the student read
 * but unable to answer — and "can you check my payment" needs an
 * answer. It now creates a thread they can reply in, reusing the same
 * two tables the teacher questions use: it is the same thing, and a
 * third table saying the same would drift from them.
 *
 * It still reaches them TWICE: the bell, where they look while using
 * the platform, and email, where they look when they are not.
 *
 * The email is best-effort — a bounced address must not lose the
 * thread, so the conversation is written first and the send reported
 * separately.
 */
export async function messageStudentAction(
  studentId: string,
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireRouteAccess("/admin");

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 191);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const alsoEmail = formData.get("alsoEmail") === "on";

  if (!subject) return { error: "اكتب عنوان الرسالة" };
  if (!body) return { error: "اكتب نصّ الرسالة" };

  const student = await queryOne<{ email: string | null; full_name: string }>(
    `SELECT u.email, p.full_name
       FROM profiles p
       LEFT JOIN users u ON u.id = p.id
      WHERE p.id = ? AND p.deleted_at IS NULL
      LIMIT 1`,
    [studentId]
  );
  if (!student) return { error: "الطالب غير موجود" };

  /* A real conversation when 23-admin-chat.sql has been run; a plain
     notification before that, so the button still works either way. */
  const chatReady = await columnExists("teacher_threads", "kind");
  let threadId: string | null = null;

  if (chatReady) {
    const admin = await getSessionUser();
    threadId = newId();
    await execute(
      `INSERT INTO teacher_threads
         (id, course_id, teacher_id, admin_id, student_id, kind, subject, status, student_unread)
       VALUES (?, NULL, NULL, ?, ?, 'admin', ?, 'open', 1)`,
      [threadId, admin?.id ?? null, studentId, subject]
    );
    await execute(
      `INSERT INTO teacher_thread_messages (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)`,
      [newId(), threadId, admin?.id ?? studentId, body]
    );
  }

  await notify({
    userId: studentId,
    type: "system",
    title: subject,
    body,
    entityType: threadId ? "thread" : "admin_message",
    entityId: threadId,
  });

  let emailNote = "";
  if (alsoEmail) {
    if (!student.email) {
      emailNote = " (لا يوجد بريد لهذا الحساب)";
    } else {
      try {
        await sendCampaignEmail(student.email, subject, body);
        emailNote = " وأُرسل بريد.";
      } catch {
        emailNote = " (تعذّر إرسال البريد — وصل الإشعار داخل المنصّة)";
      }
    }
  }

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/dashboard/messages");
  return { error: null, success: `أُرسلت الرسالة إلى ${student.full_name}.${emailNote}` };
}
