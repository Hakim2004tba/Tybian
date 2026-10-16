import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { refreshCourseAnalytics, refreshPlatformAnalytics } from "@/lib/analytics/refresh";

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

  try {
    await refreshPlatformAnalytics();
  } catch (error) {
    return NextResponse.json(
      { error: "platform_refresh_failed", detail: (error as Error).message },
      { status: 500 }
    );
  }

  let courses: { id: string }[];
  try {
    courses = await query<{ id: string }>(
      `SELECT id FROM courses WHERE status = 'published' AND deleted_at IS NULL`
    );
  } catch (error) {
    return NextResponse.json(
      { error: "course_list_failed", detail: (error as Error).message },
      { status: 500 }
    );
  }

  /*
    Sequential, not Promise.allSettled over every course at once.

    The pool holds five connections; firing one refresh per course in
    parallel would queue them all behind it anyway, and each refresh runs
    several aggregate queries. On shared hosting that is the shape of a
    request that times out halfway and leaves the snapshots half stale.
  */
  const results: PromiseSettledResult<void>[] = [];
  for (const c of courses) {
    try {
      await refreshCourseAnalytics(c.id);
      results.push({ status: "fulfilled", value: undefined });
    } catch (reason) {
      console.error("refresh-analytics: course failed", { courseId: c.id, reason });
      results.push({ status: "rejected", reason });
    }
  }

  const failedCount = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    ok: true,
    platformRefreshed: true,
    coursesRefreshed: courses.length - failedCount,
    coursesFailed: failedCount,
  });
}
