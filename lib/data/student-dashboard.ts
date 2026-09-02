import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Every query here is deliberately scoped and paginated — see the
 * route's doc comment for the overall performance strategy. Nothing in
 * this file ever does an unbounded `select *` across a user's full
 * history; each function returns exactly what its section needs.
 */

export type ProgressRow = {
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  last_lesson_id: string | null;
  last_lesson_title: string | null;
  last_section_title: string | null;
  last_position_seconds: number | null;
  last_activity_at: string | null;
};

/** One call, no course_id filter — bounded by the user's OWN enrollment
 *  count (never global data), used for stats + "continue learning".
 *  Wrapped in React's `cache()` so multiple Suspense boundaries in the
 *  same request (StatsRow + ContinueLearningCard) share one RPC call
 *  instead of issuing it twice. */
export const getAllProgress = cache(async (userId: string): Promise<ProgressRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_student_course_progress", { p_user_id: userId });
  return data ?? [];
});

export async function getProgressForCourses(userId: string, courseIds: string[]): Promise<ProgressRow[]> {
  if (!courseIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_student_course_progress", {
    p_user_id: userId,
    p_course_ids: courseIds,
  });
  return data ?? [];
}

export type DashboardStats = {
  coursesEnrolled: number;
  coursesCompleted: number;
  totalWatchSeconds: number;
  averageProgressPct: number;
};

export function computeStats(progress: ProgressRow[]): DashboardStats {
  const coursesEnrolled = progress.length;
  const coursesCompleted = progress.filter(
    (p) => p.total_lessons > 0 && p.completed_lessons >= p.total_lessons
  ).length;

  // Approximation, same as the admin dashboard's Watch Time chart:
  // last_position_seconds is "furthest point reached", not cumulative
  // watched time — there's no dedicated watch-session log yet. See
  // lib/data/admin-dashboard.ts's identical documented assumption.
  const totalWatchSeconds = progress.reduce((sum, p) => sum + (p.last_position_seconds ?? 0), 0);

  const withLessons = progress.filter((p) => p.total_lessons > 0);
  const averageProgressPct = withLessons.length
    ? Math.round(
        (withLessons.reduce((sum, p) => sum + p.completed_lessons / p.total_lessons, 0) /
          withLessons.length) *
          100
      )
    : 0;

  return { coursesEnrolled, coursesCompleted, totalWatchSeconds, averageProgressPct };
}

/** Most recently active, not-yet-completed course — for "Continue Learning". */
export function pickContinueLearning(progress: ProgressRow[]): ProgressRow | null {
  const inProgress = progress
    .filter((p) => p.last_activity_at && p.completed_lessons < p.total_lessons)
    .sort((a, b) => new Date(b.last_activity_at!).getTime() - new Date(a.last_activity_at!).getTime());
  return inProgress[0] ?? null;
}

export type EnrolledCourseSummary = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  teacherName: string | null;
};

export type PaginatedResult<T> = { items: T[]; totalCount: number; page: number; pageSize: number };

const COURSES_PAGE_SIZE = 6;

/** Paginated base course list — progress is fetched separately, scoped
 *  to just this page's course ids (see getProgressForCourses). */
export async function getEnrolledCoursesPage(
  userId: string,
  page: number
): Promise<PaginatedResult<EnrolledCourseSummary>> {
  const supabase = await createClient();
  const from = (page - 1) * COURSES_PAGE_SIZE;
  const to = from + COURSES_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("enrollments")
    .select(
      "course_id, courses ( id, slug, title, cover_url, teachers ( profiles ( full_name ) ) )",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false })
    .range(from, to);

  const items: EnrolledCourseSummary[] = (data ?? [])
    .map((row) => {
      const c = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      if (!c) return null;
      const teacherRaw = Array.isArray(c.teachers) ? c.teachers[0] : c.teachers;
      const profileRaw = teacherRaw
        ? (Array.isArray(teacherRaw.profiles) ? teacherRaw.profiles[0] : teacherRaw.profiles)
        : null;
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        cover_url: c.cover_url,
        teacherName: profileRaw?.full_name ?? null,
      };
    })
    .filter((x): x is EnrolledCourseSummary => x !== null);

  return { items, totalCount: count ?? 0, page, pageSize: COURSES_PAGE_SIZE };
}

const FAVORITES_PAGE_SIZE = 6;

export type FavoriteCourseSummary = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  rating: number;
  price: number | null;
};

export async function getFavoritesPage(
  userId: string,
  page: number
): Promise<PaginatedResult<FavoriteCourseSummary>> {
  const supabase = await createClient();
  const from = (page - 1) * FAVORITES_PAGE_SIZE;
  const to = from + FAVORITES_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("course_favorites")
    .select("course_id, courses ( id, slug, title, cover_url, rating )", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items: FavoriteCourseSummary[] = (data ?? [])
    .map((row): FavoriteCourseSummary | null => {
      const c = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      if (!c) return null;
      return { id: c.id, slug: c.slug, title: c.title, cover_url: c.cover_url, rating: c.rating, price: null };
    })
    .filter((x): x is FavoriteCourseSummary => x !== null);

  return { items, totalCount: count ?? 0, page, pageSize: FAVORITES_PAGE_SIZE };
}

const NOTIFICATIONS_PAGE_SIZE = 8;

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export async function getNotificationsPage(
  userId: string,
  page: number
): Promise<PaginatedResult<NotificationRow>> {
  const supabase = await createClient();
  const from = (page - 1) * NOTIFICATIONS_PAGE_SIZE;
  const to = from + NOTIFICATIONS_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return { items: data ?? [], totalCount: count ?? 0, page, pageSize: NOTIFICATIONS_PAGE_SIZE };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

const ACTIVITY_PAGE_SIZE = 8;

export type ActivityRow = {
  id: string;
  activity_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function getRecentActivityPage(
  userId: string,
  page: number
): Promise<PaginatedResult<ActivityRow>> {
  const supabase = await createClient();
  const from = (page - 1) * ACTIVITY_PAGE_SIZE;
  const to = from + ACTIVITY_PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("student_activity")
    .select("id, activity_type, metadata, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return { items: data ?? [], totalCount: count ?? 0, page, pageSize: ACTIVITY_PAGE_SIZE };
}
