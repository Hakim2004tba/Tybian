"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Broadcasts a notification to every active student (or every student,
 * per the `audience` toggle). Uses service_role because
 * notifications_admin_insert RLS only allows inserting ONE row at a
 * time as the caller — broadcasting to thousands of students in a
 * single request needs a bulk insert that bypasses per-row RLS
 * overhead, same rationale as other bulk admin operations in this
 * codebase.
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

  const supabase = await createClient();
  const admin = createAdminClient();

  let studentIds: string[];
  if (audience === "active") {
    const { data } = await supabase
      .from("enrollments")
      .select("user_id")
      .is("deleted_at", null)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());
    studentIds = [...new Set((data ?? []).map((e) => e.user_id))];
  } else {
    const { data } = await admin.from("profiles").select("id").eq("role", "student").is("deleted_at", null);
    studentIds = (data ?? []).map((p) => p.id);
  }

  if (studentIds.length === 0) {
    return { error: "لا يوجد طلاب مطابقون لهذا الجمهور" };
  }

  const rows = studentIds.map((user_id) => ({
    user_id,
    type: "system" as const,
    title,
    body,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) return { error: "تعذّر إرسال الإشعار: " + error.message };

  revalidatePath("/admin/notifications");
  return { error: null, success: `تم الإرسال إلى ${studentIds.length} طالب` };
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("academic_years")
    .update({ name_ar, name_en, name_fr })
    .eq("id", yearId);

  if (error) return { error: "تعذّر حفظ التعديلات" };

  revalidatePath("/admin/academic-years");
  return { error: null, success: "تم الحفظ" };
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const site_name = String(formData.get("site_name") ?? "").trim();
  const support_email = String(formData.get("support_email") ?? "").trim() || null;
  const maintenance_mode = formData.get("maintenance_mode") === "on";

  if (!site_name) return { error: "اسم المنصة مطلوب" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ site_name, support_email, maintenance_mode })
    .eq("id", 1);

  if (error) return { error: "تعذّر حفظ الإعدادات" };

  revalidatePath("/admin/settings");
  return { error: null, success: "تم حفظ الإعدادات" };
}
