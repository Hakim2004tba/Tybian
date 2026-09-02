import "server-only";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  let query = supabase
    .from("analytics_snapshots")
    .select("value, computed_at")
    .eq("scope_type", scopeType)
    .eq("metric_key", metricKey);

  query = scopeId ? query.eq("scope_id", scopeId) : query.is("scope_id", null);

  const { data } = await query.maybeSingle();
  if (!data) return null;
  return { value: data.value as T, computedAt: data.computed_at as string };
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
