"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null; success?: string | null };

const emailSchema = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------------------------------------------------------------------
// Sign up (student self-registration — teacher/admin accounts are
// created by an admin, not through this public form)
// ---------------------------------------------------------------------
export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };
  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
  if (!academicYearId) return { error: "الرجاء اختيار السنة الدراسية" };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // academic_year_id travels in the same metadata payload as
    // full_name — handle_new_auth_user() (0028) reads both directly
    // when creating the profile row. This used to be a SEPARATE
    // authenticated `.update()` call after signUp(), which silently
    // did nothing whenever Supabase's "Confirm email" setting is on:
    // no session exists yet at that point, so the update ran as
    // anonymous and RLS quietly matched 0 rows. Setting it at creation
    // time (inside a SECURITY DEFINER trigger) sidesteps that entirely.
    options: { data: { full_name: fullName, academic_year_id: academicYearId } },
  });

  if (error) return { error: translateAuthError(error.message) };
  if (!data.user) return { error: "تعذّر إنشاء الحساب، حاول مجدداً" };

  // No session means email confirmation is required before this account
  // can actually log in — send them to a clear "check your email" page
  // instead of redirecting to /student, where the auth guard would just
  // bounce them back to /login with no explanation.
  if (!data.session) {
    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------
export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };
  if (!password) return { error: "الرجاء إدخال كلمة المرور" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translateAuthError(error.message) };

  redirect(redirectTo || "/dashboard");
}

// ---------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------
// Forgot password — sends a reset email with a link back to
// /reset-password (Supabase handles the recovery token exchange).
// ---------------------------------------------------------------------
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  // Always return a generic success message regardless of whether the
  // email exists — do not leak account existence via this endpoint.
  if (error) {
    return { error: null, success: "إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة لإعادة تعيين كلمة المرور." };
  }
  return { error: null, success: "إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة لإعادة تعيين كلمة المرور." };
}

// ---------------------------------------------------------------------
// Reset password — called from /reset-password after the user follows
// the emailed recovery link (Supabase establishes a temporary session).
// ---------------------------------------------------------------------
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
  if (password !== confirmPassword) return { error: "كلمتا المرور غير متطابقتين" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: translateAuthError(error.message) };

  redirect("/login");
}

// ---------------------------------------------------------------------
// Change password (from the profile page, while already signed in —
// requires the current password to avoid session-hijack password takeover)
// ---------------------------------------------------------------------
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" };
  if (newPassword !== confirmPassword) return { error: "كلمتا المرور غير متطابقتين" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "الجلسة غير صالحة، الرجاء تسجيل الدخول مجدداً" };

  // Re-authenticate with the current password before allowing the change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) return { error: "كلمة المرور الحالية غير صحيحة" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: translateAuthError(error.message) };

  return { error: null, success: "تم تغيير كلمة المرور بنجاح" };
}

// ---------------------------------------------------------------------
// Update profile (name, avatar, academic year) — role is intentionally
// NOT editable here; a DB trigger also rejects any role change attempted
// by a non-admin, so this is defense in depth, not the only guard.
// ---------------------------------------------------------------------
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "") || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الجلسة غير صالحة" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, academic_year_id: academicYearId, phone })
    .eq("id", user.id);

  if (error) return { error: "تعذّر حفظ التعديلات" };

  revalidatePath("/student/profile");
  return { error: null, success: "تم حفظ التعديلات" };
}

export async function resendVerificationEmailAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  // Same "never reveal whether the account exists" posture as
  // requestPasswordResetAction — always a generic success message.
  if (error && error.message !== "Email not confirmed") {
    return { error: null, success: "إذا كان الحساب موجوداً، تم إرسال رسالة التحقق من جديد." };
  }
  return { error: null, success: "تم إرسال رسالة التحقق من جديد — تحقق من بريدك (وصندوق الرسائل غير المرغوبة)." };
}

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "User already registered": "هذا البريد الإلكتروني مسجّل بالفعل",
    "Email not confirmed": "الرجاء تأكيد بريدك الإلكتروني أولاً",
  };
  return map[message] ?? "حدث خطأ غير متوقع، حاول مجدداً";
}
