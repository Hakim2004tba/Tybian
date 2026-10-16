import "server-only";
import { columnExists } from "@/lib/db/tables";

/**
 * The columns to SELECT for a coupon.
 *
 * `scope` and `applicable_pack_id` arrive in 24-promo-scope.sql, so
 * naming them unconditionally takes every checkout down on a server
 * that has not run it. Absent, applyPromo reads the row as "all",
 * which is exactly what those codes did before.
 */
export async function couponColumns(): Promise<string> {
  const hasScope = await columnExists("coupons", "scope");
  return `id, code, discount_type, discount_value, applicable_course_id,
          max_uses, uses_count, starts_at, expires_at, is_active${
            hasScope ? ", scope, applicable_pack_id" : ""
          }`;
}
