"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed") {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { error } = await supabase.from("content_reports").update({ status }).eq("id", reportId);
  if (error) return { error: "تعذّر تحديث حالة البلاغ" };

  revalidatePath("/admin/comments");
  return { error: null };
}

/** Deletes (soft) the reported comment and marks the report resolved in
 *  one action — the common "this was actually bad content" path. */
export async function deleteReportedCommentAction(reportId: string, commentId: string) {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (deleteError) return { error: "تعذّر حذف التعليق" };

  await supabase.from("content_reports").update({ status: "resolved" }).eq("id", reportId);

  revalidatePath("/admin/comments");
  return { error: null };
}
