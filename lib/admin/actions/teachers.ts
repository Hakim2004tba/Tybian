"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { execute, newId, queryOne, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export type ActionState = { error: string | null; success?: string | null };

function generateTempPassword(): string {
  // 9 random bytes as base64url — 72 bits, well above any plausible
  // guessing attack on a password that exists to be changed on first
  // login.
  return randomBytes(9).toString("base64url");
}

export type CreateTeacherState = ActionState & {
  credentials?: { email: string; tempPassword: string };
};

/**
 * Creates a teacher: a login account, a profile, and the teachers row.
 *
 * The Supabase version orchestrated three services — the Admin API to
 * create an auth.users row, handle_new_auth_user() to make the profile,
 * and service_role to promote the role past prevent_role_self_escalation
 * — and unwound by deleting the auth user if any later step failed,
 * because the three could not share a transaction.
 *
 * All three tables are ours now, so this is one transaction. A failure
 * anywhere rolls the whole thing back, and there is no window in which a
 * half-created account exists to be cleaned up.
 *
 * The temporary password is returned once, in the action result, for the
 * admin to pass on — never in a URL, where it would land in browser
 * history and server logs. The teacher should change it via
 * "نسيت كلمة المرور" on first login.
 */
export async function createTeacherAction(
  _prev: CreateTeacherState,
  formData: FormData
): Promise<CreateTeacherState> {
  await requireRouteAccess("/admin");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const title = String(formData.get("title") ?? "").trim() || null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim() || null;

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "البريد الإلكتروني غير صالح" };

  const existing = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) return { error: "هذا البريد الإلكتروني مسجّل بالفعل" };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const userId = newId();

  try {
    await transaction(async (tx) => {
      /*
        email_verified_at is set at creation.

        An admin creating the account IS the verification — the teacher
        never receives a confirmation mail, so leaving it null would mark
        a legitimate account permanently unverified. The Supabase version
        passed email_confirm: true for the same reason.
      */
      await tx.execute(
        `INSERT INTO users (id, email, password_hash, email_verified_at)
         VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
        [userId, email, passwordHash]
      );
      await tx.execute(
        `INSERT INTO profiles (id, full_name, role, avatar_url) VALUES (?, ?, 'teacher', ?)`,
        [userId, fullName, avatarUrl]
      );
      await tx.execute(
        `INSERT INTO teachers (id, profile_id, title, specialty, institution, bio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId(), userId, title, specialty, institution, bio]
      );
    });
  } catch (error) {
    return { error: "تعذّر إنشاء حساب الأستاذ: " + (error as Error).message };
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

  try {
    // Both rows together: the old code wrote the profile, then the
    // teacher, and a failure between them saved the new name against the
    // old professional details.
    await transaction(async (tx) => {
      await tx.execute(`UPDATE profiles SET full_name = ?, avatar_url = ? WHERE id = ?`, [
        fullName,
        avatarUrl,
        profileId,
      ]);
      await tx.execute(
        `UPDATE teachers SET title = ?, specialty = ?, institution = ?, bio = ? WHERE id = ?`,
        [title, specialty, institution, bio, teacherId]
      );
    });
  } catch {
    return { error: "تعذّر حفظ بيانات الأستاذ" };
  }

  revalidatePath("/admin/teachers");
  return { error: null, success: "تم الحفظ" };
}

/**
 * Soft-deletes the teachers row, refusing while the teacher still owns
 * active courses.
 *
 * The check lives here because a soft delete cannot trip the ON DELETE
 * RESTRICT on courses.teacher_id — that only guards a hard delete. Left
 * to the database, a "deleted" teacher would keep appearing on their own
 * published course pages.
 */
export async function deleteTeacherAction(teacherId: string) {
  await requireRouteAccess("/admin");

  try {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM courses WHERE teacher_id = ? AND deleted_at IS NULL`,
      [teacherId]
    );
    const count = Number(row?.n ?? 0);

    if (count > 0) {
      return {
        error: `لا يمكن حذف هذا الأستاذ — لديه ${count} دورة نشطة. أعد إسناد الدورات أو احذفها أولاً.`,
      };
    }

    await execute(`UPDATE teachers SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [teacherId]);
  } catch {
    return { error: "تعذّر حذف الأستاذ" };
  }

  revalidatePath("/admin/teachers");
  return { error: null };
}
