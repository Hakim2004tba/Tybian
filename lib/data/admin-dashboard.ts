import "server-only";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";

/**
 * Admin dashboard reads.
 *
 * The Supabase header here said a student or teacher hitting these same
 * queries "would get filtered/empty results, not an error" — the
 * admin-bypass clauses in the policies were what made complete data
 * appear only for admins. There is no filtering now: these queries
 * return the whole platform to whoever runs them, so requireAdmin() at
 * the top of each one is what the policies used to be.
 */

export type WeeklyPoint = { label: string; value: number };

function weekLabel(date: Date): string {
  return date.toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" });
}

/**
 * Buckets rows into the last `weeks` seven-day windows ending today.
 *
 * Still done in TypeScript rather than a SQL GROUP BY on a week number.
 * MariaDB's WEEK() depends on server settings for where a week starts,
 * and the labels here have to line up with the buckets — doing both in
 * one place keeps them honest. The row counts are small: eight weeks of
 * one platform's activity.
 */
function bucketByWeek(rows: { created_at: string; value?: number }[], weeks = 8): WeeklyPoint[] {
  const now = new Date();
  const buckets: WeeklyPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);

    const sum = rows.reduce((acc, r) => {
      // Timestamps arrive as UTC strings without a zone marker, so the
      // Z is appended before parsing — without it these would be read as
      // local time and rows would land in the wrong week.
      const t = new Date(r.created_at.replace(" ", "T") + "Z").getTime();
      if (t >= start.getTime() && t < end.getTime()) return acc + (r.value ?? 1);
      return acc;
    }, 0);

    buckets.push({ label: weekLabel(end), value: sum });
  }

  return buckets;
}

export async function getDashboardStats() {
  await requireAdmin();

  // One query for six figures. The Supabase version issued six requests
  // and pulled every payment row and every rating back to add them up in
  // JavaScript.
  const row = await queryOne<{
    total_students: number;
    active_students: number;
    total_courses: number;
    revenue: string;
    total_enrollments: number;
    avg_rating: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM profiles WHERE role = 'student')                     AS total_students,
       (SELECT COUNT(DISTINCT user_id) FROM enrollments
         WHERE deleted_at IS NULL
           AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3)))             AS active_students,
       (SELECT COUNT(*) FROM courses WHERE deleted_at IS NULL)                    AS total_courses,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success')   AS revenue,
       (SELECT COUNT(*) FROM enrollments WHERE deleted_at IS NULL)                AS total_enrollments,
       (SELECT COALESCE(AVG(rating), 0) FROM courses WHERE rating_count > 0)      AS avg_rating`
  );

  return {
    totalStudents: Number(row?.total_students ?? 0),
    activeStudents: Number(row?.active_students ?? 0),
    totalCourses: Number(row?.total_courses ?? 0),
    revenue: Number(row?.revenue ?? 0),
    totalEnrollments: Number(row?.total_enrollments ?? 0),
    avgRating: Math.round(Number(row?.avg_rating ?? 0) * 10) / 10,
  };
}

export async function getStudentGrowthChart(): Promise<WeeklyPoint[]> {
  await requireAdmin();

  const rows = await query<{ created_at: string }>(
    `SELECT created_at FROM profiles
      WHERE role = 'student'
        AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 56 DAY)`
  );
  return bucketByWeek(rows);
}

export async function getRevenueChart(): Promise<WeeklyPoint[]> {
  await requireAdmin();

  const rows = await query<{ created_at: string; amount: string }>(
    `SELECT created_at, amount FROM payments
      WHERE status = 'success'
        AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 56 DAY)`
  );
  return bucketByWeek(rows.map((p) => ({ created_at: p.created_at, value: Number(p.amount) })));
}

export async function getCourseSalesChart(): Promise<{ label: string; value: number }[]> {
  await requireAdmin();

  const rows = await query<{ title: string; students_count: number }>(
    `SELECT title, students_count FROM courses
      WHERE deleted_at IS NULL
      ORDER BY students_count DESC
      LIMIT 5`
  );
  return rows.map((c) => ({ label: c.title, value: c.students_count }));
}

/**
 * Watch time approximated as the sum of lesson_progress.last_position_seconds
 * by the week it was last updated. There is still no watch-session table
 * — student_activity records event types, not durations — so this is a
 * proxy, the same one the student dashboard uses and says so.
 */
export async function getWatchTimeChart(): Promise<WeeklyPoint[]> {
  await requireAdmin();

  const rows = await query<{ updated_at: string; last_position_seconds: number }>(
    `SELECT updated_at, last_position_seconds FROM lesson_progress
      WHERE updated_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 56 DAY)`
  );

  const points = bucketByWeek(
    rows.map((p) => ({ created_at: p.updated_at, value: Number(p.last_position_seconds) }))
  );
  // Seconds to hours, for a readable axis.
  return points.map((p) => ({ label: p.label, value: Math.round((p.value / 3600) * 10) / 10 }));
}

export async function getRecentStudents() {
  await requireAdmin();

  const rows = await query<{
    id: string;
    full_name: string;
    created_at: string;
    year_name: string | null;
  }>(
    `SELECT p.id, p.full_name, p.created_at, ay.name_ar AS year_name
       FROM profiles p
       LEFT JOIN academic_years ay ON ay.id = p.academic_year_id
      WHERE p.role = 'student'
      ORDER BY p.created_at DESC
      LIMIT 5`
  );

  // Shape kept as the embedded-relation object the components already read.
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    created_at: r.created_at,
    academic_years: r.year_name ? { name_ar: r.year_name } : null,
  }));
}

export async function getRecentPayments() {
  await requireAdmin();

  const rows = await query<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    plan_type: string;
    created_at: string;
    student_name: string | null;
    course_title: string | null;
  }>(
    `SELECT pay.id, pay.amount, pay.currency, pay.status, pay.plan_type, pay.created_at,
            p.full_name AS student_name,
            c.title     AS course_title
       FROM payments pay
       LEFT JOIN profiles p ON p.id = pay.user_id
       LEFT JOIN courses c  ON c.id = pay.course_id
      ORDER BY pay.created_at DESC
      LIMIT 5`
  );

  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    plan_type: r.plan_type,
    created_at: r.created_at,
    profiles: r.student_name ? { full_name: r.student_name } : null,
    courses: r.course_title ? { title: r.course_title } : null,
  }));
}

export async function getRecentReviews() {
  await requireAdmin();

  const rows = await query<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    student_name: string | null;
    course_title: string | null;
  }>(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            p.full_name AS student_name,
            c.title     AS course_title
       FROM reviews r
       LEFT JOIN profiles p ON p.id = r.user_id
       LEFT JOIN courses c  ON c.id = r.course_id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 5`
  );

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    profiles: r.student_name ? { full_name: r.student_name } : null,
    courses: r.course_title ? { title: r.course_title } : null,
  }));
}
