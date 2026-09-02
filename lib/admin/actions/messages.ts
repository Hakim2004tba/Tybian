"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

export async function updateMessageStatusAction(messageId: string, status: "read" | "replied") {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { error } = await supabase.from("contact_messages").update({ status }).eq("id", messageId);
  if (error) return { error: "تعذّر تحديث حالة الرسالة" };

  revalidatePath("/admin/messages");
  return { error: null };
}
