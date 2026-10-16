"use server";

import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Marks one notification read.
 *
 * The Supabase version filtered on `id` alone, with a comment saying
 * notifications_update_own "already guarantees this can only ever touch
 * the caller's own row — no additional ownership check needed here".
 * That guarantee is gone, and the statement it protected would otherwise
 * update any row whose id someone passed in.
 *
 * So `user_id = ?` is in the WHERE clause now. It is the whole check.
 * A request for someone else's notification simply matches no rows —
 * silently, on purpose, since telling the caller the id exists but is
 * not theirs is itself a small leak.
 */
export async function markNotificationReadAction(notificationId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  try {
    await execute(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [
      notificationId,
      user.id,
    ]);
  } catch {
    return { error: "تعذّر تحديث الإشعار" };
  }

  revalidatePath("/dashboard");
  return { error: null };
}
