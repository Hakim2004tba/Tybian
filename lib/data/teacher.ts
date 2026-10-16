import "server-only";
import { query, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Everything the teacher space reads, scoped to the teacher's own work.
 *
 * ONE CHOKE POINT. Every query below starts from `ownedCourseIds()`.
 * The alternative — remembering to add `AND c.teacher_id = ?` in each
 * of a dozen queries — is the shape of bug that leaks another
 * teacher's drafts, students and revenue the one time it is forgotten.
 * An admin is deliberately given every course, which is the only place
 * that distinction is made.
 */

export type TeacherScope = {
  profileId: string;
  isAdmin: boolean;
  /** Empty means: this account owns no courses, so it sees nothing. */
  courseIds: string[];
};

export async function getTeacherScope(): Promise<TeacherScope | null> {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role === "admin") {
    const all = await query<{ id: string }>(
      `SELECT id FROM courses WHERE deleted_at IS NULL`
    );
    return { profileId: user.id, isAdmin: true, courseIds: all.map((c) => c.id) };
  }

  const mine = await query<{ id: string }>(
    `SELECT c.id
       FROM courses c
       JOIN teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = ? AND c.deleted_at IS NULL`,
    [user.id]
  );
  return { profileId: user.id, isAdmin: false, courseIds: mine.map((c) => c.id) };
}

/** `IN (?,?,?)` placeholders, or a clause that matches nothing. */
function inClause(ids: string[]): { sql: string; params: string[] } {
  if (ids.length === 0) return { sql: "(NULL)", params: [] };
  return { sql: `(${ids.map(() => "?").join(",")})`, params: ids };
}

export type TeacherCourse = {
  id: string;
  title: string;
  slug: string;
  status: string;
  students_count: number;
  rating: string;
  lesson_count: number;
};

export async function listCourses(scope: TeacherScope): Promise<TeacherCourse[]> {
  const { sql, params } = inClause(scope.courseIds);
  if (scope.courseIds.length === 0) return [];

  return query<TeacherCourse>(
    `SELECT c.id, c.title, c.slug, c.status, c.students_count, c.rating,
            (SELECT COUNT(*) FROM lessons l
               JOIN course_sections s ON s.id = l.section_id
              WHERE s.course_id = c.id AND l.deleted_at IS NULL) AS lesson_count
       FROM courses c
      WHERE c.id IN ${sql}
      ORDER BY c.created_at DESC`,
    params
  );
}

export type TeacherStats = {
  courses: number;
  students: number;
  openQuestions: number;
  upcomingMeetings: number;
  avgRating: number;
};

export async function getStats(scope: TeacherScope): Promise<TeacherStats> {
  if (scope.courseIds.length === 0) {
    return { courses: 0, students: 0, openQuestions: 0, upcomingMeetings: 0, avgRating: 0 };
  }
  const { sql, params } = inClause(scope.courseIds);

  const [students, questions, meetings, rating] = await Promise.all([
    queryOne<{ n: number }>(
      `SELECT COUNT(DISTINCT e.user_id) AS n
         FROM enrollments e
        WHERE e.course_id IN ${sql}
          AND e.deleted_at IS NULL
          AND e.starts_at <= UTC_TIMESTAMP(3)
          AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))`,
      params
    ),
    queryOne<{ n: number }>(
      /*
        "Open" means nobody has replied at all. A question the teacher
        has answered is not open; neither is one a classmate answered.
      */
      `SELECT COUNT(*) AS n
         FROM comments cm
         JOIN lessons l ON l.id = cm.lesson_id
         JOIN course_sections s ON s.id = l.section_id
        WHERE s.course_id IN ${sql}
          AND cm.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM comment_replies r
             WHERE r.comment_id = cm.id AND r.deleted_at IS NULL)`,
      params
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM meetings m
        WHERE m.deleted_at IS NULL
          AND m.status = 'scheduled'
          AND m.starts_at > UTC_TIMESTAMP(3)
          AND (m.course_id IN ${sql}
               OR m.teacher_id IN (SELECT id FROM teachers WHERE profile_id = ?))`,
      [...params, scope.profileId]
    ),
    queryOne<{ avg_rating: string | null }>(
      `SELECT AVG(r.rating) AS avg_rating
         FROM reviews r
        WHERE r.course_id IN ${sql} AND r.deleted_at IS NULL`,
      params
    ),
  ]);

  return {
    courses: scope.courseIds.length,
    students: Number(students?.n ?? 0),
    openQuestions: Number(questions?.n ?? 0),
    upcomingMeetings: Number(meetings?.n ?? 0),
    avgRating: Number(rating?.avg_rating ?? 0),
  };
}

export type TeacherQuestion = {
  id: string;
  body: string;
  created_at: string;
  student_name: string;
  lesson_id: string;
  lesson_title: string;
  course_slug: string;
  course_title: string;
  reply_count: number;
};

/** Student questions on this teacher's lessons, unanswered first. */
export async function listQuestions(scope: TeacherScope, limit = 50): Promise<TeacherQuestion[]> {
  if (scope.courseIds.length === 0) return [];
  const { sql, params } = inClause(scope.courseIds);

  return query<TeacherQuestion>(
    `SELECT cm.id, cm.body, cm.created_at,
            p.full_name AS student_name,
            l.id AS lesson_id, l.title AS lesson_title,
            c.slug AS course_slug, c.title AS course_title,
            (SELECT COUNT(*) FROM comment_replies r
              WHERE r.comment_id = cm.id AND r.deleted_at IS NULL) AS reply_count
       FROM comments cm
       JOIN profiles p ON p.id = cm.user_id
       JOIN lessons l ON l.id = cm.lesson_id
       JOIN course_sections s ON s.id = l.section_id
       JOIN courses c ON c.id = s.course_id
      WHERE s.course_id IN ${sql} AND cm.deleted_at IS NULL
      ORDER BY reply_count ASC, cm.created_at DESC
      LIMIT ?`,
    [...params, limit]
  );
}

export type TeacherStudent = {
  user_id: string;
  full_name: string;
  course_title: string;
  course_id: string;
  enrolled_at: string;
  completed_lessons: number;
  total_lessons: number;
};

export async function listStudents(scope: TeacherScope, limit = 200): Promise<TeacherStudent[]> {
  if (scope.courseIds.length === 0) return [];
  const { sql, params } = inClause(scope.courseIds);

  return query<TeacherStudent>(
    `SELECT e.user_id, p.full_name, c.title AS course_title, c.id AS course_id,
            e.starts_at AS enrolled_at,
            (SELECT COUNT(*) FROM lesson_progress lp
               JOIN lessons l2 ON l2.id = lp.lesson_id
               JOIN course_sections s2 ON s2.id = l2.section_id
              WHERE lp.user_id = e.user_id AND s2.course_id = c.id AND lp.is_completed = 1) AS completed_lessons,
            (SELECT COUNT(*) FROM lessons l3
               JOIN course_sections s3 ON s3.id = l3.section_id
              WHERE s3.course_id = c.id AND l3.deleted_at IS NULL) AS total_lessons
       FROM enrollments e
       JOIN profiles p ON p.id = e.user_id
       JOIN courses c ON c.id = e.course_id
      WHERE e.course_id IN ${sql}
        AND e.deleted_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY e.starts_at DESC
      LIMIT ?`,
    [...params, limit]
  );
}

export type TeacherReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  student_name: string;
  course_title: string;
};

export async function listReviews(scope: TeacherScope, limit = 50): Promise<TeacherReview[]> {
  if (scope.courseIds.length === 0) return [];
  const { sql, params } = inClause(scope.courseIds);

  return query<TeacherReview>(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            p.full_name AS student_name, c.title AS course_title
       FROM reviews r
       JOIN profiles p ON p.id = r.user_id
       JOIN courses c ON c.id = r.course_id
      WHERE r.course_id IN ${sql} AND r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT ?`,
    [...params, limit]
  );
}

/** The teacher's own lessons, for the QCM editor's picker. */
export async function listLessons(scope: TeacherScope): Promise<{ id: string; label: string }[]> {
  if (scope.courseIds.length === 0) return [];
  const { sql, params } = inClause(scope.courseIds);

  const rows = await query<{ id: string; title: string; course_title: string }>(
    `SELECT l.id, l.title, c.title AS course_title
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
       JOIN courses c ON c.id = s.course_id
      WHERE s.course_id IN ${sql} AND l.deleted_at IS NULL
      ORDER BY c.title, s.sort_order, l.sort_order
      LIMIT 500`,
    params
  );
  return rows.map((r) => ({ id: r.id, label: `${r.course_title} — ${r.title}` }));
}

/** Whether a lesson belongs to this teacher — the QCM editor's gate. */
export async function ownsLesson(scope: TeacherScope, lessonId: string): Promise<boolean> {
  if (scope.courseIds.length === 0) return false;
  const { sql, params } = inClause(scope.courseIds);

  const row = await queryOne<{ ok: number }>(
    `SELECT 1 AS ok
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
      WHERE l.id = ? AND s.course_id IN ${sql} AND l.deleted_at IS NULL
      LIMIT 1`,
    [lessonId, ...params]
  );
  return row !== null;
}
