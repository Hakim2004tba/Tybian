"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { columnExists } from "@/lib/db/tables";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Creating a promo code. Admin only.
 *
 * The code is stored uppercase and compared uppercase at checkout, so
 * "club20" and "CLUB20" are the same code. A club that prints its code
 * on a poster does not control how a student types it, and two codes
 * differing only in case would be two different budgets.
 */
export async function createCouponAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();
  const t = dict.admin.promo;

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("discountType") ?? "percentage") === "fixed" ? "fixed" : "percentage";
  const value = Number(formData.get("discountValue") ?? 0);
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim() || null;
  const rawScope = String(formData.get("scope") ?? "all");
  const scope = rawScope === "courses" || rawScope === "packs" ? rawScope : "all";
  const packId = String(formData.get("packId") ?? "").trim() || null;

  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) return { error: t.errCode };
  if (!Number.isFinite(value) || value <= 0) return { error: t.errValue };
  /* A percentage above 100 would hand money back. */
  if (type === "percentage" && value > 100) return { error: t.errPercent };

  /* A code cannot be pinned to a course AND to a pack — the two name
     different things and nothing could satisfy both. */
  if (courseId && packId) return { error: "اختر دورة أو باقة، لا الاثنين" };

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM coupons WHERE UPPER(code) = ? AND deleted_at IS NULL LIMIT 1`,
    [code]
  );
  if (existing) return { error: t.errDuplicate };

  const maxUses = maxUsesRaw ? Math.max(1, Math.floor(Number(maxUsesRaw))) : null;

  /*
    The date arrives as a local calendar day from a date input and is
    stored as the END of that day in UTC — a code that "expires on the
    30th" should work all of the 30th, not stop at midnight starting it.
  */
  const expiresAt = expiresRaw ? `${expiresRaw} 23:59:59` : null;

  /* scope/applicable_pack_id arrive in 24-promo-scope.sql; written
     only when they exist so creating a code still works before it. */
  const scoped = await columnExists("coupons", "scope");
  await execute(
    scoped
      ? `INSERT INTO coupons
           (id, code, discount_type, discount_value, scope, applicable_course_id,
            applicable_pack_id, max_uses, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      : `INSERT INTO coupons
           (id, code, discount_type, discount_value, applicable_course_id, max_uses, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    scoped
      ? [newId(), code, type, value, scope, courseId, packId, maxUses, expiresAt]
      : [newId(), code, type, value, courseId, maxUses, expiresAt]
  );

  revalidatePath("/admin/promo");
  return { error: null, success: t.created };
}

export async function toggleCouponAction(couponId: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();

  await execute(`UPDATE coupons SET is_active = 1 - is_active WHERE id = ?`, [couponId]);
  revalidatePath("/admin/promo");
  return { error: null, success: dict.admin.promo.updated };
}
