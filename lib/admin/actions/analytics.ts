"use server";

import { revalidatePath } from "next/cache";
import { requireRouteAccess } from "@/lib/auth/session";
import { refreshCourseAnalytics, refreshPlatformAnalytics } from "@/lib/analytics/refresh";

/**
 * Manual "تحديث الآن" for an admin who does not want to wait for the
 * scheduled refresh (app/api/cron/refresh-analytics is the production
 * path).
 *
 * The refresh functions were SECURITY DEFINER plpgsql called through a
 * service_role client, precisely because they were meant to run in a
 * trusted context rather than a user session. They are ordinary
 * TypeScript now with no privilege of their own, so requireRouteAccess
 * is the entire boundary — it must stay the first statement.
 */
export async function refreshPlatformAnalyticsAction() {
  await requireRouteAccess("/admin");

  try {
    await refreshPlatformAnalytics();
  } catch {
    return { error: "تعذّر تحديث التحليلات" };
  }

  revalidatePath("/admin/analytics");
  return { error: null };
}

export async function refreshCourseAnalyticsAction(courseId: string) {
  await requireRouteAccess("/admin");

  try {
    await refreshCourseAnalytics(courseId);
  } catch {
    return { error: "تعذّر تحديث تحليلات الدورة" };
  }

  revalidatePath(`/admin/courses/${courseId}/analytics`);
  return { error: null };
}
