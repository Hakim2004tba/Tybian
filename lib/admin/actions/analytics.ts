"use server";

import { revalidatePath } from "next/cache";
import { requireRouteAccess } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Manual "تحديث الآن" trigger for an admin who doesn't want to wait for
 * the next scheduled refresh (see app/api/cron/refresh-analytics for
 * the production scheduled path). Uses service_role since
 * refresh_platform_analytics()/refresh_course_analytics() are
 * SECURITY DEFINER and meant to be called from a trusted backend
 * context, not a plain authenticated session.
 */
export async function refreshPlatformAnalyticsAction() {
  await requireRouteAccess("/admin");
  const admin = createAdminClient();

  const { error } = await admin.rpc("refresh_platform_analytics");
  if (error) return { error: "تعذّر تحديث التحليلات" };

  revalidatePath("/admin/analytics");
  return { error: null };
}

export async function refreshCourseAnalyticsAction(courseId: string) {
  await requireRouteAccess("/admin");
  const admin = createAdminClient();

  const { error } = await admin.rpc("refresh_course_analytics", { p_course_id: courseId });
  if (error) return { error: "تعذّر تحديث تحليلات الدورة" };

  revalidatePath(`/admin/courses/${courseId}/analytics`);
  return { error: null };
}
