import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * All queries here run through the caller's authenticated Supabase
 * session (not the service_role client) — they only return complete
 * data because the caller is an admin and the `*_admin_write`/
 * `*_select_own_or_admin` RLS policies in 0009_rls_policies.sql grant
 * admins full read access. A student or teacher session hitting these
 * same queries would get filtered/empty results, not an error.
 */

export type WeeklyPoint = { label: string; value: number };

function weekLabel(date: Date): string {
  return date.toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" });
}

/** Buckets rows into the last `weeks` 7-day windows ending today. */
function bucketByWeek(
  rows: { created_at: string; value?: number }[],
  weeks = 8
): WeeklyPoint[] {
  const now = new Date();
  const buckets: WeeklyPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);

    const sum = rows.reduce((acc, r) => {
      const t = new Date(r.created_at).getTime();
      if (t >= start.getTime() && t < end.getTime()) {
        return acc + (r.value ?? 1);
      }
      return acc;
    }, 0);

    buckets.push({ label: weekLabel(end), value: sum });
  }

  return buckets;
}

export async function getDashboardStats() {
  const supabase = await createClient();

  const [
    totalStudents,
    activeEnrollments,
    totalCourses,
    paidPayments,
    totalEnrollments,
    ratedCourses,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase
      .from("enrollments")
      .select("user_id")
      .is("deleted_at", null)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString()),
    supabase.from("courses").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("payments").select("amount").eq("status", "success"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("courses").select("rating").gt("rating_count", 0),
  ]);

  const activeStudentsCount = new Set((activeEnrollments.data ?? []).map((e) => e.user_id)).size;
  const revenue = (paidPayments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const ratings = (ratedCourses.data ?? []).map((c) => Number(c.rating));
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return {
    totalStudents: totalStudents.count ?? 0,
    activeStudents: activeStudentsCount,
    totalCourses: totalCourses.count ?? 0,
    revenue,
    totalEnrollments: totalEnrollments.count ?? 0,
    avgRating: Math.round(avgRating * 10) / 10,
  };
}

export async function getStudentGrowthChart(): Promise<WeeklyPoint[]> {
  const supabase = await createClient();
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("role", "student")
    .gte("created_at", eightWeeksAgo.toISOString());

  return bucketByWeek(data ?? []);
}

export async function getRevenueChart(): Promise<WeeklyPoint[]> {
  const supabase = await createClient();
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { data } = await supabase
    .from("payments")
    .select("created_at, amount")
    .eq("status", "success")
    .gte("created_at", eightWeeksAgo.toISOString());

  return bucketByWeek((data ?? []).map((p) => ({ created_at: p.created_at, value: Number(p.amount) })));
}

export async function getCourseSalesChart(): Promise<{ label: string; value: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("title, students_count")
    .is("deleted_at", null)
    .order("students_count", { ascending: false })
    .limit(5);

  return (data ?? []).map((c) => ({ label: c.title, value: c.students_count }));
}

/**
 * Watch Time is approximated as the sum of `lesson_progress.last_position_seconds`
 * updated per week — there is no dedicated watch-session/duration log table
 * yet (student_activity records event types, not durations), so this is a
 * reasonable proxy rather than an exact "minutes watched" figure. Revisit
 * once a proper watch-session table exists.
 */
export async function getWatchTimeChart(): Promise<WeeklyPoint[]> {
  const supabase = await createClient();
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { data } = await supabase
    .from("lesson_progress")
    .select("updated_at, last_position_seconds")
    .gte("updated_at", eightWeeksAgo.toISOString());

  const points = bucketByWeek(
    (data ?? []).map((p) => ({ created_at: p.updated_at, value: Number(p.last_position_seconds) }))
  );
  // convert seconds -> hours for a readable chart
  return points.map((p) => ({ label: p.label, value: Math.round((p.value / 3600) * 10) / 10 }));
}

export async function getRecentStudents() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, academic_years(name_ar)")
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export async function getRecentPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, currency, status, plan_type, created_at, profiles(full_name), courses(title)")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export async function getRecentReviews() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, profiles(full_name), courses(title)")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}
