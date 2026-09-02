import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cron/refresh-analytics
 *
 * Intended to be called on a schedule (e.g. Vercel Cron, or any
 * external scheduler hitting this URL with the shared secret) — this is
 * what actually keeps `analytics_snapshots` warm in production, rather
 * than relying on an admin remembering to click "Refresh now".
 *
 * Protected by a shared secret header rather than a user session, since
 * a cron trigger has no browser/cookies at all. Refreshes the platform
 * snapshot plus every published course's snapshot — bounded by the
 * platform's actual course count, which is the right scope for this
 * (not attempting incremental/partial refresh in this phase).
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.ANALYTICS_CRON_SECRET || secret !== process.env.ANALYTICS_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error: platformError } = await admin.rpc("refresh_platform_analytics");
  if (platformError) {
    return NextResponse.json({ error: "platform_refresh_failed", detail: platformError.message }, { status: 500 });
  }

  const { data: courses, error: coursesError } = await admin
    .from("courses")
    .select("id")
    .eq("status", "published")
    .is("deleted_at", null);

  if (coursesError) {
    return NextResponse.json({ error: "course_list_failed", detail: coursesError.message }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (courses ?? []).map((c) => admin.rpc("refresh_course_analytics", { p_course_id: c.id }))
  );

  const failedCount = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    ok: true,
    platformRefreshed: true,
    coursesRefreshed: (courses ?? []).length - failedCount,
    coursesFailed: failedCount,
  });
}
