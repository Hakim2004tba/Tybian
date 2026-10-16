"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, pool, query } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { columnExists } from "@/lib/db/tables";
import { extractVimeoSource, serializeVimeoSource } from "@/lib/video/extract-vimeo-event";

export type ActionState = { error: string | null; success?: string | null };

/** Rows per INSERT when broadcasting. See the note in the action below. */
const BROADCAST_CHUNK = 500;

/**
 * Broadcasts a notification to every student, or only those with active
 * access.
 *
 * This used service_role specifically because notifications_admin_insert
 * allowed one row at a time as the caller, and a broadcast needs a bulk
 * insert. There is no RLS and no service_role now, so the reason is gone
 * — but the bulk insert stays, because inserting several thousand rows
 * one statement at a time over a five-connection pool is how this
 * request times out.
 *
 * Chunked rather than one giant statement: MariaDB's max_allowed_packet
 * is typically 16MB on shared hosting and a single INSERT with tens of
 * thousands of value tuples can exceed it, which fails the whole
 * broadcast rather than part of it.
 */
export async function sendBroadcastNotificationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  const audience = String(formData.get("audience") ?? "all");

  if (!title) return { error: "الرجاء إدخال عنوان الإشعار" };

  try {
    const recipients =
      audience === "active"
        ? await query<{ user_id: string }>(
            `SELECT DISTINCT e.user_id
               FROM enrollments e
               JOIN profiles p ON p.id = e.user_id AND p.deleted_at IS NULL
              WHERE e.deleted_at IS NULL
                AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))`
          )
        : await query<{ user_id: string }>(
            `SELECT id AS user_id FROM profiles
              WHERE role = 'student' AND deleted_at IS NULL`
          );

    if (recipients.length === 0) {
      return { error: "لا يوجد طلاب مطابقون لهذا الجمهور" };
    }

    /*
      created_at is set explicitly, to one value shared by every row.

      The admin broadcast list groups rows by (title, body, type,
      created_at) to show one entry per broadcast. Letting each row take
      its own DEFAULT CURRENT_TIMESTAMP(3) would spread a large send
      across several milliseconds and split one broadcast into several
      list entries with wrong recipient counts.
    */
    const sentAt = new Date().toISOString().slice(0, 23).replace("T", " ");

    for (let i = 0; i < recipients.length; i += BROADCAST_CHUNK) {
      const chunk = recipients.slice(i, i + BROADCAST_CHUNK);
      const values = chunk.map(() => "(?, ?, 'system', ?, ?, ?)").join(",");
      const args = chunk.flatMap((r) => [newId(), r.user_id, title, body, sentAt]);

      // `query`, not `execute`: mysql2's prepared-statement path caches
      // by SQL text, and a statement whose placeholder count changes per
      // chunk would fill that cache with single-use entries.
      await pool().query(
        `INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES ${values}`,
        args
      );
    }

    revalidatePath("/admin/notifications");
    return { error: null, success: `تم الإرسال إلى ${recipients.length} طالب` };
  } catch (error) {
    return { error: "تعذّر إرسال الإشعار: " + (error as Error).message };
  }
}

export async function updateAcademicYearNamesAction(
  yearId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_en = String(formData.get("name_en") ?? "").trim() || null;
  const name_fr = String(formData.get("name_fr") ?? "").trim() || null;

  if (!name_ar) return { error: "الاسم بالعربية مطلوب" };

  try {
    await execute(
      `UPDATE academic_years SET name_ar = ?, name_en = ?, name_fr = ? WHERE id = ?`,
      [name_ar, name_en, name_fr, yearId]
    );
  } catch {
    return { error: "تعذّر حفظ التعديلات" };
  }

  revalidatePath("/admin/academic-years");
  return { error: null, success: "تم الحفظ" };
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const site_name = String(formData.get("site_name") ?? "").trim();
  const support_email = String(formData.get("support_email") ?? "").trim() || null;
  const maintenance_mode = formData.get("maintenance_mode") === "on";

  if (!site_name) return { error: "اسم المنصة مطلوب" };

  /*
    The homepage explainer. Parsed rather than stored raw, so a bad
    link is refused while the admin is still looking at the form
    instead of becoming an empty frame on the front page. Empty clears
    it, which removes the section entirely.
  */
  const introRaw = String(formData.get("intro_video") ?? "").trim();
  let intro: string | null = null;
  if (introRaw) {
    const parsed = extractVimeoSource(introRaw);
    if (!parsed) return { error: "رابط الفيديو ليس رابط Vimeo صالحاً" };
    intro = serializeVimeoSource(parsed);
  }

  try {
    const hasIntro = await columnExists("platform_settings", "intro_video");
    await execute(
      hasIntro
        ? `UPDATE platform_settings
              SET site_name = ?, support_email = ?, maintenance_mode = ?, intro_video = ?
            WHERE id = 1`
        : `UPDATE platform_settings
              SET site_name = ?, support_email = ?, maintenance_mode = ?
            WHERE id = 1`,
      hasIntro
        ? [site_name, support_email, maintenance_mode ? 1 : 0, intro]
        : [site_name, support_email, maintenance_mode ? 1 : 0]
    );
  } catch {
    return { error: "تعذّر حفظ الإعدادات" };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { error: null, success: "تم حفظ الإعدادات" };
}
