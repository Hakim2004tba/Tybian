"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

function generateTempPassword(): string {
  // 12 random bytes -> readable base64url string, well above typical
  // minimum password strength requirements.
  return randomBytes(9).toString("base64url");
}

export type CreateTeacherState = ActionState & { credentials?: { email: string; tempPassword: string } };

/**
 * Creating a teacher is NOT just an insert into `teachers` — a teacher
 * needs a real login account. This creates the auth.users row via the
 * Supabase Admin API (which fires handle_new_auth_user, 0007, creating
 * the profiles row with role='student' by default), promotes that
 * profile to role='teacher' via service_role (the only path allowed
 * through prevent_role_self_escalation, 0009/0020), then creates the
 * teachers row itself.
 *
 * No email-sending is configured in this project yet, so the generated
 * temporary password is returned once, inline in the action's result
 * (never in the URL — a query param would leak into browser history and
 * server logs) for the admin to share with the teacher directly. The
 * teacher should change it via "نسيت كلمة المرور" on first login.
 *
 * If any later step fails after the auth user is created, the auth
 * user is deleted again so a failed attempt never leaves an orphaned,
 * half-created account.
 */
export async function createTeacherAction(
  _prev: CreateTeacherState,
  formData: FormData
): Promise<CreateTeacherState> {
  await requireRouteAccess("/admin");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim() || null;

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "البريد الإلكتروني غير صالح" };

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return { error: "تعذّر إنشاء الحساب: " + (createError?.message ?? "خطأ غير معروف") };
  }

  const userId = created.user.id;

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "teacher", avatar_url: avatarUrl })
    .eq("id", userId);
  if (roleError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "تعذّر ترقية الحساب إلى أستاذ" };
  }

  const { error: teacherError } = await admin
    .from("teachers")
    .insert({ profile_id: userId, title, specialty, institution, bio });

  if (teacherError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "تعذّر إنشاء سجل الأستاذ: " + teacherError.message };
  }

  revalidatePath("/admin/teachers");
  return {
    error: null,
    success: "تم إنشاء حساب الأستاذ بنجاح",
    credentials: { email, tempPassword },
  };
}

export async function updateTeacherAction(
  teacherId: string,
  profileId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim() || null;

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, avatar_url: avatarUrl })
    .eq("id", profileId);
  if (profileError) return { error: "تعذّر حفظ الاسم" };

  const { error: teacherError } = await supabase
    .from("teachers")
    .update({ title, specialty, institution, bio })
    .eq("id", teacherId);
  if (teacherError) return { error: "تعذّر حفظ بيانات الأستاذ" };

  revalidatePath("/admin/teachers");
  return { error: null, success: "تم الحفظ" };
}

/**
 * Soft-deletes the teachers row only — blocked if the teacher still has
 * any non-deleted courses (courses.teacher_id has ON DELETE RESTRICT at
 * the DB level for a HARD delete, but a soft delete wouldn't trip that
 * constraint at all, silently leaving courses pointing at a "deleted"
 * teacher — so this check is enforced here, at the application layer,
 * not left to the database to catch).
 */
export async function deleteTeacherAction(teacherId: string) {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .is("deleted_at", null);

  if (count && count > 0) {
    return { error: `لا يمكن حذف هذا الأستاذ — لديه ${count} دورة نشطة. أعد إسناد الدورات أو احذفها أولاً.` };
  }

  const { error } = await supabase
    .from("teachers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", teacherId);

  if (error) return { error: "تعذّر حذف الأستاذ" };

  revalidatePath("/admin/teachers");
  return { error: null };
}
