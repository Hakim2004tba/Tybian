"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * RLS's `notifications_update_own` (0009_rls_policies.sql) already
 * guarantees this can only ever touch the caller's own row — no
 * additional ownership check needed here.
 */
export async function markNotificationReadAction(notificationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) return { error: "تعذّر تحديث الإشعار" };
  revalidatePath("/dashboard");
  return { error: null };
}
