"use server";

import { revalidatePath } from "next/cache";
import { expiryFor } from "@/lib/plans/duration";
import { refreshCourseStudents, refreshCoursesForUser } from "@/lib/data/counters";
import { execute, newId, queryOne, toSql, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Promotes any registered profile to role='admin'.
 *
 * The Supabase version leaned on two database mechanisms and said so:
 * profiles_update_own_or_admin let an admin session update any profile,
 * and prevent_role_self_escalation (0009/0020) allowed the change
 * *because the caller was an admin*. Both are gone. `requireRouteAccess`
 * is now the only thing between this statement and anyone who can reach
 * a server action — it must remain the first line.
 *
 * Still does not create a `teachers` row: promoting to admin is a role
 * change, not teacher onboarding, which has its own flow.
 */
export async function promoteToAdminAction(userId: string) {
  await requireRouteAccess("/admin");

  try {
    await execute(`UPDATE profiles SET role = 'admin' WHERE id = ?`, [userId]);
  } catch (error) {
    return { error: "تعذّر ترقية المستخدم: " + (error as Error).message };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/teachers");
  revalidatePath(`/admin/students/${userId}`);
  return { error: null };
}

/**
 * Grants a student access to a course without payment —
 * enrollments.source = 'admin_grant'.
 *
 * The duplicate check was a convenience before: uq_enrollments_active_user_course
 * would have rejected a second active grant anyway, and this only ran
 * first to avoid showing a raw constraint error. That index was PARTIAL
 * and has no MariaDB equivalent, so the check IS the constraint now — and
 * it runs inside a transaction with the insert, because a check outside
 * one is just a suggestion when two admins click at once.
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

  /*
    The length comes from the COURSE'S OWN PLAN, not from a constant.

    Ninety days was hard-coded here, so an admin who set a course to six
    months still granted three — and the student's card said "3 أشهر"
    while the pricing page said six. Same slot, two different answers.
    See tibyan-db/mysql/10-plan-duration.sql.
  */
  const planRow = await queryOne<{ duration_days: number | null }>(
    `SELECT duration_days FROM course_prices
      WHERE course_id = ? AND plan_type = ? AND is_active = 1
      LIMIT 1`,
    [courseId, planType]
  );

  /* No priced row at all: fall back to what the slot used to mean, so
     a course that was never priced still grants something sensible. */
  const days =
    planRow === null
      ? planType === "lifetime"
        ? null
        : 90
      : planRow.duration_days === null
        ? null
        : Number(planRow.duration_days);

  const expiry = expiryFor(days, new Date());
  const expiresAt = expiry === null ? null : toSql(expiry);

  try {
    const conflict = await transaction(async (tx) => {
      const [rows] = await tx.execute(
        `SELECT id FROM enrollments
          WHERE user_id = ? AND course_id = ?
            AND deleted_at IS NULL
            AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
          LIMIT 1
          FOR UPDATE`,
        [studentId, courseId]
      );
      if ((rows as unknown[]).length > 0) return true;

      await tx.execute(
        `INSERT INTO enrollments (id, user_id, course_id, plan_type, source, expires_at)
         VALUES (?, ?, ?, ?, 'admin_grant', ?)`,
        [newId(), studentId, courseId, planType, expiresAt]
      );

      /* The catalogue's "N students" is a stored column — see
         lib/data/counters.ts for why it is stored and why it was
         reading zero. Same transaction as the enrolment it counts. */
      await refreshCourseStudents(courseId, tx);
      return false;
    });

    if (conflict) return { error: "هذا الطالب يملك وصولاً فعّالاً لهذه الدورة بالفعل" };
  } catch (error) {
    return { error: "تعذّر منح الوصول: " + (error as Error).message };
  }

  revalidatePath(`/admin/students/${studentId}`);
  return { error: null, success: "تم منح الوصول للدورة بنجاح" };
}

/** Kept for callers that need a quick existence probe. */
export async function studentExistsAction(studentId: string): Promise<boolean> {
  await requireRouteAccess("/admin");
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM profiles WHERE id = ? AND deleted_at IS NULL`,
    [studentId]
  );
  return row !== null;
}

/**
 * Deletes a user account, even when they hold active enrollments.
 *
 * Two levels, because they are genuinely different decisions:
 *
 *  - DEFAULT (soft): the profile is marked deleted and every enrollment
 *    revoked. The person can no longer be found in listings and their
 *    access ends, but the row survives, so payment history and any audit
 *    trail still resolve to a real person rather than a dangling id.
 *    Reversible.
 *
 *  - `hardDelete`: additionally removes the `users` row. Every table
 *    keyed on the user cascades from it — enrollments, progress, notes,
 *    reviews, study marks, sketches — and it is IRREVERSIBLE. Offered
 *    because "delete my data" is a request an admin must be able to
 *    honour, not because it is the normal path.
 *
 * What changed in the port: the hard delete used to need the
 * service-role admin API, because removing an auth.users row was
 * something no user session could do by design. That protection was the
 * database's. Here it is a plain DELETE that any query in this app could
 * issue, so `requireRouteAccess` plus the explicit `force` flag are the
 * only things standing in front of it.
 *
 * Active enrollments never block either level; the caller is told the
 * count so the admin confirms with full knowledge — the same shape
 * deleteCourseAction uses.
 *
 * An admin cannot delete their own account here: locking yourself out of
 * the only admin panel is not a decision to make by misclick.
 */
export async function deleteUserAccountAction(
  userId: string,
  options: { force?: boolean; hardDelete?: boolean } = {}
) {
  const admin = await requireRouteAccess("/admin");

  if (admin.id === userId) {
    return { error: "لا يمكنك حذف حسابك أنت من هنا." };
  }

  try {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM enrollments
        WHERE user_id = ?
          AND deleted_at IS NULL
          AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))`,
      [userId]
    );
    const activeEnrollments = Number(row?.n ?? 0);

    if (!options.force) {
      return {
        error: null as string | null,
        requiresConfirmation: true,
        activeEnrollments,
      };
    }

    /*
      One transaction for the whole delete.

      The Supabase version revoked enrollments, then soft-deleted the
      profile, then optionally removed the auth user — three independent
      writes. A failure partway left an account with revoked access but a
      live profile, or a deleted profile whose enrollments still counted
      as active in every report.
    */
    await transaction(async (tx) => {
      if (activeEnrollments > 0) {
        await tx.execute(
          `UPDATE enrollments SET deleted_at = UTC_TIMESTAMP(3)
            WHERE user_id = ? AND deleted_at IS NULL`,
          [userId]
        );
      }

      /* Those revoked enrolments were being counted on every course
         they touched. Recount before the profile goes. */
      if (activeEnrollments > 0) await refreshCoursesForUser(userId, tx);

      await tx.execute(`UPDATE profiles SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [userId]);

      if (options.hardDelete) {
        // Every other table cascades from `users` — including profiles,
        // sessions and auth_tokens — so this one statement is the whole
        // hard delete. It also signs them out everywhere, immediately.
        await tx.execute(`DELETE FROM users WHERE id = ?`, [userId]);
      }
    });
  } catch (error) {
    return { error: "تعذّر حذف الحساب: " + (error as Error).message };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/teachers");
  return { error: null };
}
