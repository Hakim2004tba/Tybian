"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Upserts both plan prices in one call. Pricing writes are admin-only —
 * enforced independently by RLS (`course_prices_admin_write`) even
 * though this action already sits behind requireRouteAccess("/admin").
 * A teacher hitting this action directly (bypassing the UI) would still
 * be rejected at the database layer.
 */
export async function updateCoursePricingAction(
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const threeMonthsPrice = Number(formData.get("threeMonthsPrice") ?? "");
  const lifetimePrice = Number(formData.get("lifetimePrice") ?? "");

  if (!Number.isFinite(threeMonthsPrice) || threeMonthsPrice < 0) {
    return { error: "سعر الاشتراك لمدة 3 أشهر غير صالح" };
  }
  if (!Number.isFinite(lifetimePrice) || lifetimePrice < 0) {
    return { error: "سعر الاشتراك مدى الحياة غير صالح" };
  }

  const supabase = await createClient();

  // course_prices intentionally has only a PARTIAL unique index
  // (course_id, plan_type) WHERE is_active — so old prices stay in the
  // table as inactive history rather than being overwritten. That means
  // a plain `.upsert(..., { onConflict: "course_id,plan_type" })` can't
  // be used here (Postgres ON CONFLICT can't target a partial index via
  // supabase-js), so each plan is updated-if-exists / inserted-if-not,
  // explicitly, preserving that history design.
  for (const [planType, price] of [
    ["three_months", threeMonthsPrice],
    ["lifetime", lifetimePrice],
  ] as const) {
    const { data: existing } = await supabase
      .from("course_prices")
      .select("id")
      .eq("course_id", courseId)
      .eq("plan_type", planType)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("course_prices")
        .update({ price })
        .eq("id", existing.id);
      if (error) return { error: `تعذّر تحديث سعر (${planType}): ${error.message}` };
    } else {
      const { error } = await supabase
        .from("course_prices")
        .insert({ course_id: courseId, plan_type: planType, price, is_active: true });
      if (error) return { error: `تعذّر إضافة سعر (${planType}): ${error.message}` };
    }
  }

  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null, success: "تم حفظ الأسعار" };
}
