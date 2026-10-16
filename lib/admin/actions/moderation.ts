"use server";

import { revalidatePath } from "next/cache";
import { execute, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed") {
  await requireRouteAccess("/admin");

  /*
    The report_status ENUM is ('pending','reviewed','dismissed') — there
    is no 'resolved' member. Writing it non-strictly would store the
    empty string and the row would drop out of every status filter,
    including the pending queue, so it would look resolved by accident.
    'reviewed' is the column's word for the same thing.
  */
  const dbStatus = status === "resolved" ? "reviewed" : "dismissed";

  try {
    await execute(`UPDATE content_reports SET status = ? WHERE id = ?`, [dbStatus, reportId]);
  } catch {
    return { error: "تعذّر تحديث حالة البلاغ" };
  }

  revalidatePath("/admin/comments");
  return { error: null };
}

/**
 * Soft-deletes the reported comment and closes the report together — the
 * common "this really was bad content" path.
 *
 * One transaction, which the Supabase version could not express: it
 * deleted the comment, then updated the report in a second statement
 * whose failure it ignored entirely. A crash between the two left the
 * comment gone and the report still sitting in the queue.
 */
export async function deleteReportedCommentAction(reportId: string, commentId: string) {
  await requireRouteAccess("/admin");

  try {
    await transaction(async (tx) => {
      await tx.execute(`UPDATE comments SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [commentId]);
      await tx.execute(`UPDATE content_reports SET status = 'reviewed' WHERE id = ?`, [reportId]);
    });
  } catch {
    return { error: "تعذّر حذف التعليق" };
  }

  revalidatePath("/admin/comments");
  return { error: null };
}
