"use server";

import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Points the caller's profile at a newly uploaded avatar, or clears it.
 *
 * The upload itself goes through /api/admin/upload's sibling flow and
 * lands on the server's own disk; this only records the resulting path.
 * `id = user.id` plus a session-derived id is the whole rule now —
 * profiles_update_own_or_admin used to be the second layer.
 */
export async function setAvatarUrlAction(url: string | null) {
  const user = await getSessionUser();
  if (!user) return { error: "يجب تسجيل الدخول." };

  /*
    Only a path from our own uploads directory is accepted.

    The Supabase version checked the URL began with that project's
    storage host, for a real reason: without it this field becomes an
    open image redirect — any external URL would be rendered site-wide
    wherever an avatar appears, which is a tracking pixel at best.

    Avatars are now local files, so the check is that the value is a
    root-relative path under /uploads/avatars/ and contains no traversal.
    A leading "//" is rejected too: "//evil.com/x.png" is a
    protocol-relative URL, not a local path, and startsWith would
    otherwise wave it through.
  */
  if (url) {
    const ok =
      url.startsWith("/uploads/avatars/") && !url.startsWith("//") && !url.includes("..");
    if (!ok) return { error: "رابط الصورة غير صالح." };
  }

  try {
    await execute(`UPDATE profiles SET avatar_url = ? WHERE id = ?`, [url, user.id]);
  } catch (error) {
    return { error: "تعذّر حفظ الصورة: " + (error as Error).message };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { error: null };
}
