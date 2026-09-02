"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Promotes ANY registered profile — student, teacher, or already-admin —
 * to role='admin'. Relies entirely on existing, already-tested
 * infrastructure rather than adding new privilege logic:
 *  - RLS `profiles_update_own_or_admin` already lets an admin session
 *    update any profile row (is_admin() branch).
 *  - The `prevent_role_self_escalation` trigger (0009/0020) already
 *    allows the change specifically because the CALLER is an admin.
 * This action is a thin, guarded wrapper around that — no new DB
 * privilege surface is introduced.
 *
 * Deliberately does NOT also create a `teachers` row the way the
 * dedicated "إضافة أستاذ" flow does — promoting straight to admin here
 * is a pure role change, not a teacher onboarding flow.
 */
export async function promoteToAdminAction(userId: string) {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (error) return { error: "تعذّر ترقية المستخدم: " + error.message };

  revalidatePath("/admin/students");
  revalidatePath("/admin/teachers");
  revalidatePath(`/admin/students/${userId}`);
  return { error: null };
}

/**
 * Grants a student access to any course directly, bypassing payment —
 * `enrollments.source = 'admin_grant'` (the enum value already existed
 * in the schema for exactly this case, from 0004_engagement.sql, but
 * had no UI until now). Uses the admin's own authenticated session:
 * `enrollments_admin_write` RLS (0009) already permits an admin to
 * insert enrollment rows directly.
 *
 * Blocks a duplicate active grant for the same (student, course) up
 * front with a friendly message — the DB's own partial unique index
 * (uq_enrollments_active_user_course) would reject it anyway, but
 * checking first avoids surfacing a raw constraint-violation error.
 */
export async function grantEnrollmentAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const courseId = String(formData.get("courseId") ?? "");
  const planType = String(formData.get("planType") ?? "");

  if (!courseId) return { error: "الرجاء اختيار الدورة" };
  if (planType !== "three_months" && planType !== "lifetime") {
    return { error: "الرجاء اختيار نوع الاشتراك" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", studentId)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .maybeSingle();

  if (existing) return { error: "هذا الطالب يملك وصولاً فعّالاً لهذه الدورة بالفعل" };

  const expiresAt =
    planType === "lifetime" ? null : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("enrollments").insert({
    user_id: studentId,
    course_id: courseId,
    plan_type: planType,
    source: "admin_grant",
    expires_at: expiresAt,
  });

  if (error) return { error: "تعذّر منح الوصول: " + error.message };

  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: "تم منح الوصول للدورة بنجاح" };
}
