"use server";

import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";

export async function updateMessageStatusAction(messageId: string, status: "read" | "replied") {
  // Redirects a non-admin before any statement runs. `status` is typed
  // to two literals and reaches SQL as a bound parameter, so the ENUM
  // column cannot be written anything else.
  await requireRouteAccess("/admin");

  try {
    await execute(`UPDATE contact_messages SET status = ? WHERE id = ?`, [status, messageId]);
  } catch {
    return { error: "تعذّر تحديث حالة الرسالة" };
  }

  revalidatePath("/admin/messages");
  return { error: null };
}
