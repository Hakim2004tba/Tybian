import "server-only";
import { execute, newId, query, queryOne } from "@/lib/db";

/**
 * Recomputes the analytics snapshots.
 *
 * Replaces refresh_platform_analytics() and refresh_course_analytics()
 * from 0022, which were SECURITY DEFINER plpgsql. They are TypeScript
 * now, but the arithmetic is unchanged — the figures these write are the
 * ones the admin dashboard has always shown, and a difference here would
 * be a reporting bug rather than a design decision.
 *
 * Two translations worth naming:
 *
 *   count(*) filter (where X)   ->  COUNT(CASE WHEN X THEN 1 END)
 *   nullif(count(...), 0)       ->  NULLIF(...), which MariaDB has
 *
 * Both are about the same thing: dividing by zero on an empty platform.
 * Postgres returned NULL and coalesced it to 0; the same guard is kept
 * rather than letting a brand-new install produce NaN in a dashboard.
 *
 * Callers must be authorised before reaching here — the analytics cron
 * route checks its shared secret, and the admin actions check the role.
 * This module does not, deliberately: it is a computation, and hiding an
 * authorization check inside it would make the real boundary harder to
 * see.
 */

/** Upsert one snapshot row. */
async function writeSnapshot(
  scopeType: "platform" | "course",
  scopeId: string | null,
  metricKey: string,
  value: unknown
): Promise<void> {
  /*
    `scope_id` is the literal '-' for platform rows, never NULL.

    Postgres used `unique nulls not distinct` so the platform row could
    not be inserted twice; MariaDB treats every NULL in a unique key as
    distinct, which would let this cron append a fresh duplicate on every
    single run. The sentinel keeps the unique key meaningful — see the
    note on the table in 01-schema.sql.
  */
  await execute(
    `INSERT INTO analytics_snapshots (id, scope_type, scope_id, metric_key, value, computed_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE value = VALUES(value), computed_at = VALUES(computed_at)`,
    [newId(), scopeType, scopeId ?? "-", metricKey, JSON.stringify(value)]
  );
}

export async function refreshPlatformAnalytics(): Promise<void> {
  const overview = await queryOne<{
    total_students: number;
    active_students: number;
    new_students_30d: number;
    total_enrollments: number;
    revenue_total: string;
    revenue_30d: string;
    avg_rating: string | null;
    total_watch_seconds: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM profiles WHERE role = 'student' AND deleted_at IS NULL) AS total_students,
       (SELECT COUNT(DISTINCT user_id) FROM enrollments
         WHERE deleted_at IS NULL
           AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3)))               AS active_students,
       (SELECT COUNT(*) FROM profiles
         WHERE role = 'student' AND deleted_at IS NULL
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY))           AS new_students_30d,
       (SELECT COUNT(*) FROM enrollments WHERE deleted_at IS NULL)                  AS total_enrollments,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success')     AS revenue_total,
       (SELECT COALESCE(SUM(amount), 0) FROM payments
         WHERE status = 'success'
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY))           AS revenue_30d,
       (SELECT COALESCE(AVG(rating), 0) FROM courses
         WHERE rating_count > 0 AND deleted_at IS NULL)                             AS avg_rating,
       (SELECT COALESCE(SUM(last_position_seconds), 0) FROM lesson_progress)        AS total_watch_seconds`
  );

  /*
    Completion rate: the share of enrolments where the student has
    finished every lesson. `c.lessons_count` is the denormalised count on
    the course, which is what the original used too — so if that column
    drifts from reality, this figure drifts with it, exactly as before.
  */
  const completion = await queryOne<{ pct: string | null }>(
    `SELECT COALESCE(
              100.0 * COUNT(CASE WHEN completed_lessons >= total_lessons AND total_lessons > 0 THEN 1 END)
                    / NULLIF(COUNT(CASE WHEN total_lessons > 0 THEN 1 END), 0),
              0) AS pct
       FROM (
         SELECT c.lessons_count AS total_lessons,
                (SELECT COUNT(*)
                   FROM lesson_progress lp
                   JOIN lessons l          ON l.id = lp.lesson_id
                   JOIN course_sections cs ON cs.id = l.section_id
                  WHERE cs.course_id = c.id AND lp.user_id = e.user_id AND lp.is_completed = 1
                ) AS completed_lessons
           FROM enrollments e
           JOIN courses c ON c.id = e.course_id
          WHERE e.deleted_at IS NULL
       ) per_enrollment`
  );

  const popular = await query<{
    course_id: string;
    title: string;
    students_count: number;
    rating: string;
  }>(
    `SELECT id AS course_id, title, students_count, rating
       FROM courses
      WHERE deleted_at IS NULL AND status = 'published'
      ORDER BY students_count DESC
      LIMIT 8`
  );

  await writeSnapshot("platform", null, "overview", {
    total_students: Number(overview?.total_students ?? 0),
    active_students: Number(overview?.active_students ?? 0),
    new_students_30d: Number(overview?.new_students_30d ?? 0),
    total_enrollments: Number(overview?.total_enrollments ?? 0),
    revenue_total: Number(overview?.revenue_total ?? 0),
    revenue_30d: Number(overview?.revenue_30d ?? 0),
    avg_rating: round1(Number(overview?.avg_rating ?? 0)),
    total_watch_seconds: Number(overview?.total_watch_seconds ?? 0),
    completion_rate_pct: round1(Number(completion?.pct ?? 0)),
  });

  await writeSnapshot(
    "platform",
    null,
    "popular_courses",
    popular.map((c) => ({
      course_id: c.course_id,
      title: c.title,
      students_count: Number(c.students_count),
      rating: Number(c.rating),
    }))
  );
}

export async function refreshCourseAnalytics(courseId: string): Promise<void> {
  const overview = await queryOne<{
    students_count: number;
    revenue_total: string;
    avg_rating: string | null;
    total_watch_seconds: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM enrollments WHERE course_id = ? AND deleted_at IS NULL) AS students_count,
       (SELECT COALESCE(SUM(amount), 0) FROM payments
         WHERE course_id = ? AND status = 'success')                                 AS revenue_total,
       (SELECT rating FROM courses WHERE id = ?)                                     AS avg_rating,
       (SELECT COALESCE(SUM(lp.last_position_seconds), 0)
          FROM lesson_progress lp
          JOIN lessons l          ON l.id = lp.lesson_id
          JOIN course_sections cs ON cs.id = l.section_id
         WHERE cs.course_id = ?)                                                     AS total_watch_seconds`,
    [courseId, courseId, courseId, courseId]
  );

  const rates = await queryOne<{ completion_pct: string | null; avg_progress_pct: string | null }>(
    `SELECT COALESCE(
              100.0 * COUNT(CASE WHEN completed_lessons >= total_lessons AND total_lessons > 0 THEN 1 END)
                    / NULLIF(COUNT(CASE WHEN total_lessons > 0 THEN 1 END), 0),
              0) AS completion_pct,
            COALESCE(
              AVG(CASE WHEN total_lessons > 0
                       THEN 100.0 * completed_lessons / total_lessons END),
              0) AS avg_progress_pct
       FROM (
         SELECT c.lessons_count AS total_lessons,
                (SELECT COUNT(*)
                   FROM lesson_progress lp
                   JOIN lessons l          ON l.id = lp.lesson_id
                   JOIN course_sections cs ON cs.id = l.section_id
                  WHERE cs.course_id = ? AND lp.user_id = e.user_id AND lp.is_completed = 1
                ) AS completed_lessons
           FROM enrollments e
           JOIN courses c ON c.id = e.course_id
          WHERE e.course_id = ? AND e.deleted_at IS NULL
       ) per_student`,
    [courseId, courseId]
  );

  const engagement = await query<{
    lesson_id: string;
    title: string;
    engaged_count: number;
    avg_watch_seconds: string | null;
  }>(
    `SELECT l.id AS lesson_id, l.title,
            COUNT(DISTINCT lp.user_id) AS engaged_count,
            ROUND(COALESCE(AVG(lp.last_position_seconds), 0)) AS avg_watch_seconds
       FROM lessons l
       JOIN course_sections cs      ON cs.id = l.section_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
      WHERE cs.course_id = ? AND l.deleted_at IS NULL AND cs.deleted_at IS NULL
      GROUP BY l.id, l.title, cs.sort_order, l.sort_order
      ORDER BY cs.sort_order, l.sort_order`,
    [courseId]
  );

  /*
    Dropout is measured against the FIRST lesson's engagement, not
    against total enrolments — the original function's own comment
    insists on this. A student who bought the course and never opened it
    is not a dropout from lesson 5; the curve is meant to show where
    people who actually started stop.
  */
  const baseline = Number(engagement[0]?.engaged_count ?? 0);

  await writeSnapshot("course", courseId, "overview", {
    students_count: Number(overview?.students_count ?? 0),
    revenue_total: Number(overview?.revenue_total ?? 0),
    completion_rate_pct: round1(Number(rates?.completion_pct ?? 0)),
    avg_progress_pct: round1(Number(rates?.avg_progress_pct ?? 0)),
    avg_rating: Number(overview?.avg_rating ?? 0),
    total_watch_seconds: Number(overview?.total_watch_seconds ?? 0),
  });

  await writeSnapshot(
    "course",
    courseId,
    "lesson_engagement",
    engagement.map((e) => ({
      lesson_id: e.lesson_id,
      title: e.title,
      engaged_count: Number(e.engaged_count),
      avg_watch_seconds: Number(e.avg_watch_seconds ?? 0),
      dropout_pct: baseline === 0 ? 0 : round1(100 * (1 - Number(e.engaged_count) / baseline)),
    }))
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
