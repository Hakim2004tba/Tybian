import "server-only";
import { queryOne } from "@/lib/db";

/**
 * Every function here reads a pre-computed snapshot from
 * analytics_snapshots — none of them scan raw tables. If a snapshot
 * doesn't exist yet (first run before any refresh), callers get `null`
 * and should render an empty/"not yet computed" state rather than
 * falling back to a live computation, which would defeat the point.
 *
 * Extensibility: adding a new platform or course metric means adding a
 * key to the relevant SQL refresh function's jsonb output
 * (0022_analytics_snapshots.sql) and a field to the TypeScript type
 * below — no new table, no new query shape here.
 */

export type PlatformOverview = {
  total_students: number;
  active_students: number;
  new_students_30d: number;
  total_enrollments: number;
  revenue_total: number;
  revenue_30d: number;
  avg_rating: number;
  total_watch_seconds: number;
  completion_rate_pct: number;
};

export type PopularCourse = {
  course_id: string;
  title: string;
  students_count: number;
  rating: number;
};

async function getSnapshot<T>(scopeType: "platform" | "course", scopeId: string | null, metricKey: string) {
  // Platform rows store the literal '-' rather than NULL — MariaDB
  // treats NULLs in a unique key as distinct, so the sentinel is what
  // keeps one row per (scope, metric). See lib/analytics/refresh.ts.
  const row = await queryOne<{ value: unknown; computed_at: string }>(
    `SELECT value, computed_at
       FROM analytics_snapshots
      WHERE scope_type = ? AND scope_id = ? AND metric_key = ?`,
    [scopeType, scopeId ?? "-", metricKey]
  );

  if (!row) return null;

  // MariaDB stores JSON as LONGTEXT, so the driver may hand back the raw
  // string rather than a parsed value depending on version.
  const value = typeof row.value === "string" ? safeParse(row.value) : row.value;
  if (value === null) return null;

  return { value: value as T, computedAt: row.computed_at };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getPlatformOverview() {
  return getSnapshot<PlatformOverview>("platform", null, "overview");
}

export async function getPopularCourses() {
  return getSnapshot<PopularCourse[]>("platform", null, "popular_courses");
}

export type CourseOverview = {
  students_count: number;
  revenue_total: number;
  completion_rate_pct: number;
  avg_progress_pct: number;
  avg_rating: number;
  total_watch_seconds: number;
};

export type LessonEngagement = {
  lesson_id: string;
  title: string;
  engaged_count: number;
  avg_watch_seconds: number;
  dropout_pct: number;
};

export async function getCourseOverview(courseId: string) {
  return getSnapshot<CourseOverview>("course", courseId, "overview");
}

export async function getCourseLessonEngagement(courseId: string) {
  return getSnapshot<LessonEngagement[]>("course", courseId, "lesson_engagement");
}
