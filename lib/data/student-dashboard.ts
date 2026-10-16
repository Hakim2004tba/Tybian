import "server-only";
import { cache } from "react";
import { query, queryOne, toBool, type SqlValue } from "@/lib/db";

/**
 * Student dashboard reads.
 *
 * Every function takes `userId` and binds it into the WHERE clause. That
 * was true before too, but it was belt-and-braces then: the
 * `*_select_own` policies made a forgotten filter harmless. It is load
 * bearing now — a missing `user_id = ?` here returns other students'
 * enrolments, notifications and history.
 *
 * The get_student_course_progress() RPC is gone; getAllProgress() below
 * computes the same rows in SQL. Nothing here does an unbounded read
 * across a user's full history — each function returns exactly what its
 * section needs.
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

type TotalsRow = {
  course_id: string;
  total_lessons: number | string;
  completed_lessons: number | string;
};

type LastRow = {
  course_id: string;
  lesson_id: string;
  lesson_title: string;
  section_title: string;
  last_position_seconds: number;
  updated_at: string;
};

/**
 * Progress across the courses a student currently has access to.
 *
 * Replaces the get_student_course_progress() RPC. Two queries rather than
 * one: the per-course totals, and the single most recent lesson per
 * course. Doing both at once would need a lateral join, which MariaDB
 * does not have, and five correlated subqueries in one SELECT is worse
 * than two clear statements.
 *
 * Still wrapped in React's `cache()` so several Suspense boundaries in
 * one request (StatsRow and ContinueLearningCard) share the work instead
 * of each issuing its own queries.
 */
export const getAllProgress = cache(
  async (userId: string): Promise<ProgressRow[]> => fetchProgress(userId, null)
);

export async function getProgressForCourses(
  userId: string,
  courseIds: string[]
): Promise<ProgressRow[]> {
  if (!courseIds.length) return [];
  return fetchProgress(userId, courseIds);
}

async function fetchProgress(userId: string, courseIds: string[] | null): Promise<ProgressRow[]> {
  const scope = courseIds ? ` AND e.course_id IN (${courseIds.map(() => "?").join(",")})` : "";
  const scopeArgs: SqlValue[] = courseIds ?? [];

  /*
    The enrolment filter is the same three conditions as the guard's —
    not revoked, started, not expired — so a dashboard never lists a
    course the student can no longer open.

    COUNT(DISTINCT ...) because the two LEFT JOINs multiply rows against
    each other: without it, a course with 10 lessons and 4 completions
    would report 40 lessons.
  */
  try {
    const totals = await query<TotalsRow>(
      `SELECT e.course_id,
              COUNT(DISTINCT l.id) AS total_lessons,
              COUNT(DISTINCT CASE WHEN lp.is_completed = 1 THEN lp.lesson_id END) AS completed_lessons
         FROM enrollments e
         LEFT JOIN course_sections s ON s.course_id = e.course_id AND s.deleted_at IS NULL
         LEFT JOIN lessons l         ON l.section_id = s.id       AND l.deleted_at IS NULL
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id      AND lp.user_id = e.user_id
        WHERE e.user_id = ?
          AND e.deleted_at IS NULL
          AND e.starts_at <= UTC_TIMESTAMP(3)
          AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))${scope}
        GROUP BY e.course_id`,
      [userId, ...scopeArgs]
    );

    if (!totals.length) return [];

    const ids = totals.map((t) => t.course_id);
    const placeholders = ids.map(() => "?").join(",");

    /*
      The most recently touched lesson per course.

      The inner query finds each course's latest updated_at, and the
      outer joins back to the row carrying it. A plain GROUP BY would
      return the max timestamp attached to an arbitrary lesson — MariaDB
      permits that and gives the wrong lesson title.
    */
    const last = await query<LastRow>(
      `SELECT s.course_id, l.id AS lesson_id, l.title AS lesson_title,
              s.title AS section_title, lp.last_position_seconds, lp.updated_at
         FROM lesson_progress lp
         JOIN lessons l         ON l.id = lp.lesson_id AND l.deleted_at IS NULL
         JOIN course_sections s ON s.id = l.section_id AND s.deleted_at IS NULL
         JOIN (
           SELECT s2.course_id, MAX(lp2.updated_at) AS newest
             FROM lesson_progress lp2
             JOIN lessons l2         ON l2.id = lp2.lesson_id
             JOIN course_sections s2 ON s2.id = l2.section_id
            WHERE lp2.user_id = ? AND s2.course_id IN (${placeholders})
            GROUP BY s2.course_id
         ) newest ON newest.course_id = s.course_id AND newest.newest = lp.updated_at
        WHERE lp.user_id = ?`,
      [userId, ...ids, userId]
    );

    const lastByCourse = new Map(last.map((r) => [r.course_id, r]));

    return totals.map((t) => {
      const l = lastByCourse.get(t.course_id);
      return {
        course_id: t.course_id,
        total_lessons: Number(t.total_lessons),
        completed_lessons: Number(t.completed_lessons),
        last_lesson_id: l?.lesson_id ?? null,
        last_lesson_title: l?.lesson_title ?? null,
        last_section_title: l?.section_title ?? null,
        last_position_seconds: l?.last_position_seconds ?? null,
        last_activity_at: l?.updated_at ?? null,
      };
    });
  } catch {
    return [];
  }
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

  // Approximation, unchanged from before: last_position_seconds is
  // "furthest point reached", not cumulative watch time — there is no
  // watch-session log. lib/data/admin-dashboard.ts makes the same
  // assumption and says so too.
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

export async function getEnrolledCoursesPage(
  userId: string,
  page: number
): Promise<PaginatedResult<EnrolledCourseSummary>> {
  const offset = (page - 1) * COURSES_PAGE_SIZE;

  // `starts_at <= now` joins the two conditions the Supabase `.or()`
  // expressed, for the same reason as everywhere else in this port.
  const where = `e.user_id = ?
      AND e.deleted_at IS NULL
      AND e.starts_at <= UTC_TIMESTAMP(3)
      AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
      AND c.deleted_at IS NULL`;

  try {
    const [rows, total] = await Promise.all([
      query<{
        id: string;
        slug: string;
        title: string;
        cover_url: string | null;
        teacher_name: string | null;
      }>(
        `SELECT c.id, c.slug, c.title, c.cover_url, p.full_name AS teacher_name
           FROM enrollments e
           JOIN courses c       ON c.id = e.course_id
           LEFT JOIN teachers t ON t.id = c.teacher_id
           LEFT JOIN profiles p ON p.id = t.profile_id
          WHERE ${where}
          ORDER BY e.created_at DESC
          LIMIT ? OFFSET ?`,
        [userId, COURSES_PAGE_SIZE, offset]
      ),
      queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n
           FROM enrollments e JOIN courses c ON c.id = e.course_id
          WHERE ${where}`,
        [userId]
      ),
    ]);

    return {
      items: rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        cover_url: c.cover_url,
        teacherName: c.teacher_name,
      })),
      totalCount: Number(total?.n ?? 0),
      page,
      pageSize: COURSES_PAGE_SIZE,
    };
  } catch {
    return { items: [], totalCount: 0, page, pageSize: COURSES_PAGE_SIZE };
  }
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
  const offset = (page - 1) * FAVORITES_PAGE_SIZE;

  try {
    const [rows, total] = await Promise.all([
      query<{
        id: string;
        slug: string;
        title: string;
        cover_url: string | null;
        rating: string;
      }>(
        `SELECT c.id, c.slug, c.title, c.cover_url, c.rating
           FROM course_favorites f
           JOIN courses c ON c.id = f.course_id
          WHERE f.user_id = ? AND c.deleted_at IS NULL
          ORDER BY f.created_at DESC
          LIMIT ? OFFSET ?`,
        [userId, FAVORITES_PAGE_SIZE, offset]
      ),
      queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n
           FROM course_favorites f JOIN courses c ON c.id = f.course_id
          WHERE f.user_id = ? AND c.deleted_at IS NULL`,
        [userId]
      ),
    ]);

    return {
      items: rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        cover_url: c.cover_url,
        rating: Number(c.rating),
        // Kept null, as before: the favourites card does not show a
        // price, and joining course_prices per row would buy nothing.
        price: null,
      })),
      totalCount: Number(total?.n ?? 0),
      page,
      pageSize: FAVORITES_PAGE_SIZE,
    };
  } catch {
    return { items: [], totalCount: 0, page, pageSize: FAVORITES_PAGE_SIZE };
  }
}

const NOTIFICATIONS_PAGE_SIZE = 8;

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  /** What it points at, so the row can be a link to somewhere useful. */
  related_entity_type: string | null;
  related_entity_id: string | null;
};

export async function getNotificationsPage(
  userId: string,
  page: number
): Promise<PaginatedResult<NotificationRow>> {
  const offset = (page - 1) * NOTIFICATIONS_PAGE_SIZE;

  try {
    const [rows, total] = await Promise.all([
      query<Omit<NotificationRow, "is_read"> & { is_read: number }>(
        `SELECT id, type, title, body, is_read, created_at,
                related_entity_type, related_entity_id
           FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [userId, NOTIFICATIONS_PAGE_SIZE, offset]
      ),
      queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?`, [userId]),
    ]);

    return {
      items: rows.map((r) => ({ ...r, is_read: toBool(r.is_read) })),
      totalCount: Number(total?.n ?? 0),
      page,
      pageSize: NOTIFICATIONS_PAGE_SIZE,
    };
  } catch {
    return { items: [], totalCount: 0, page, pageSize: NOTIFICATIONS_PAGE_SIZE };
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0`,
    [userId]
  );
  return Number(row?.n ?? 0);
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
  const offset = (page - 1) * ACTIVITY_PAGE_SIZE;

  try {
    const [rows, total] = await Promise.all([
      query<{
        id: string;
        activity_type: string;
        metadata: unknown;
        created_at: string;
      }>(
        `SELECT id, activity_type, metadata, created_at
           FROM student_activity
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [userId, ACTIVITY_PAGE_SIZE, offset]
      ),
      queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM student_activity WHERE user_id = ?`, [
        userId,
      ]),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        activity_type: r.activity_type,
        // MariaDB stores JSON as LONGTEXT, so a driver may return the
        // raw string; the column is also nullable here where Postgres
        // defaulted it to '{}'. Both mean "no metadata".
        metadata: parseMetadata(r.metadata),
        created_at: r.created_at,
      })),
      totalCount: Number(total?.n ?? 0),
      page,
      pageSize: ACTIVITY_PAGE_SIZE,
    };
  } catch {
    return { items: [], totalCount: 0, page, pageSize: ACTIVITY_PAGE_SIZE };
  }
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** The newest few notifications, for the bell dropdown. */
export async function getRecentNotifications(
  userId: string,
  limit = 6
): Promise<NotificationRow[]> {
  try {
    const rows = await query<Omit<NotificationRow, "is_read"> & { is_read: number }>(
      `SELECT id, type, title, body, is_read, created_at,
              related_entity_type, related_entity_id
         FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ${Number(limit)}`,
      [userId]
    );
    return rows.map((r) => ({ ...r, is_read: toBool(r.is_read) }));
  } catch {
    return [];
  }
}
