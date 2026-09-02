"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DiscussionActionState = { error: string | null; success?: string | null };

/**
 * RLS's `comments_insert_own` (0009_rls_policies.sql) already restricts
 * this to inserting rows owned by the caller — no extra check needed
 * here beyond requiring a session.
 */
export async function addCommentAction(
  lessonId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "الرجاء كتابة سؤالك أو تعليقك" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { error } = await supabase.from("comments").insert({
    lesson_id: lessonId,
    user_id: user.id,
    body,
  });

  if (error) return { error: "تعذّر إرسال التعليق" };

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

/**
 * Any authenticated user may reply (student-to-student discussion is
 * allowed), but the UI badges a reply as "الأستاذ"/"الإدارة" when the
 * replier is the course's owning teacher or an admin — see
 * DiscussionPanel.tsx. RLS (comment_replies_insert_own) is the actual
 * enforcement for "reply must be your own", same pattern as comments.
 */
export async function addReplyAction(
  commentId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "الرجاء كتابة الرد" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { error } = await supabase.from("comment_replies").insert({
    comment_id: commentId,
    user_id: user.id,
    body,
  });

  if (error) return { error: "تعذّر إرسال الرد" };

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

  const supabase = await createClient();
  // comments_update_own_or_admin RLS scopes this to the caller's own
  // comment (or admin) regardless of the id supplied here.
  const { error } = await supabase.from("comments").update({ body }).eq("id", commentId);
  if (error) return { error: "تعذّر حفظ التعديل" };

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

export async function deleteCommentAction(commentId: string, courseSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) return { error: "تعذّر حذف التعليق" };
  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

export async function editReplyAction(
  replyId: string,
  courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "لا يمكن حفظ رد فارغ" };

  const supabase = await createClient();
  const { error } = await supabase.from("comment_replies").update({ body }).eq("id", replyId);
  if (error) return { error: "تعذّر حفظ التعديل" };

  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

export async function deleteReplyAction(replyId: string, courseSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("comment_replies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", replyId);

  if (error) return { error: "تعذّر حذف الرد" };
  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}

/**
 * Any authenticated user may report a comment; content_reports'
 * uq_content_reports_pending_reporter_target (0019) prevents the same
 * user from spamming reports on the same comment while one is still
 * pending — a second attempt here surfaces as a friendly message
 * rather than a raw constraint error.
 */
export async function reportCommentAction(
  commentId: string,
  _courseSlug: string,
  _prev: DiscussionActionState,
  formData: FormData
): Promise<DiscussionActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "الرجاء ذكر سبب الإبلاغ" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: "comment",
    target_id: commentId,
    reason,
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: null, success: "لديك بلاغ قيد المراجعة على هذا التعليق بالفعل" };
    }
    return { error: "تعذّر إرسال البلاغ" };
  }

  return { error: null, success: "تم إرسال البلاغ، شكراً لك" };
}

/**
 * Wraps the pin_comment() SECURITY DEFINER function (0019) — admin OR
 * the owning teacher may pin. The function itself is the real
 * authorization boundary (re-verified independently by
 * trg_comments_prevent_pin_bypass, 0021); this action is a thin caller.
 */
export async function togglePinCommentAction(commentId: string, courseSlug: string, nextValue: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pin_comment", { p_comment_id: commentId, p_pinned: nextValue });

  if (error) return { error: "لا تملك صلاحية تثبيت هذا التعليق" };
  revalidatePath(`/courses/${courseSlug}/learn`);
  return { error: null };
}
