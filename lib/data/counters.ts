import "server-only";
import type { PoolConnection } from "mysql2/promise";
import { execute } from "@/lib/db";

/**
 * The denormalised counters on `courses` and `teachers`, kept true.
 *
 * WHY THEY WERE ALL ZERO. `courses.students_count`, `teachers.students_count`
 * and `courses.rating_count` are summary columns that the catalogue, the
 * teacher list and the admin tables all read. Nothing in the application
 * has ever written them: they were filled once during the move off
 * Supabase and have been frozen since — which is why every course showed
 * "0 students" no matter how many people had enrolled. The same defect
 * as `courses.min_price`, in three more columns.
 *
 * WHY NOT COMPUTE THEM LIVE. Because they are also SORTED and FILTERED
 * by — "most popular" is an ORDER BY on students_count — and a subquery
 * in an ORDER BY cannot use an index. Denormalisation is the right call
 * for a sortable summary. It simply has to be maintained, which is what
 * this file is.
 *
 * Every function takes an optional transaction so the counter is
 * updated inside the same transaction as the row that changed it: a
 * count committed separately from the enrolment it counts is a count
 * that can disagree with reality after a crash.
 */

type Runner = { execute: PoolConnection["execute"] } | null;

async function run(tx: Runner, sql: string, params: unknown[]): Promise<void> {
  if (tx) await tx.execute(sql, params as never);
  else await execute(sql, params as never);
}

/**
 * Recounts one course's students, and the teacher who owns it.
 *
 * An "enrolled student" is one with a live enrolment — not deleted, and
 * not expired. A three-month plan that ran out in June should not still
 * be inflating a course's headline number in December.
 */
export async function refreshCourseStudents(courseId: string, tx: Runner = null): Promise<void> {
  await run(
    tx,
    `UPDATE courses c
        SET c.students_count = (
          SELECT COUNT(DISTINCT e.user_id) FROM enrollments e
           WHERE e.course_id = c.id
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
        )
      WHERE c.id = ?`,
    [courseId]
  );

  /*
    And the teacher's total, which is DISTINCT across their courses —
    one student enrolled in three of a teacher's courses is one student,
    not three. Summing the per-course counts would have said three.
  */
  await run(
    tx,
    `UPDATE teachers t
        SET t.students_count = (
          SELECT COUNT(DISTINCT e.user_id)
            FROM enrollments e
            JOIN courses c2 ON c2.id = e.course_id
           WHERE c2.teacher_id = t.id
             AND c2.deleted_at IS NULL
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
        )
      WHERE t.id = (SELECT teacher_id FROM courses WHERE id = ?)`,
    [courseId]
  );
}

/** Recounts a course's published reviews and its average rating. */
export async function refreshCourseRating(courseId: string, tx: Runner = null): Promise<void> {
  await run(
    tx,
    `UPDATE courses c
        SET c.rating_count = (
              SELECT COUNT(*) FROM reviews r
               WHERE r.course_id = c.id AND r.deleted_at IS NULL
            ),
            c.rating = COALESCE((
              SELECT ROUND(AVG(r.rating), 1) FROM reviews r
               WHERE r.course_id = c.id AND r.deleted_at IS NULL
            ), 0)
      WHERE c.id = ?`,
    [courseId]
  );
}

/** Recounts a course's lessons and total runtime. */
export async function refreshCourseContent(courseId: string, tx: Runner = null): Promise<void> {
  await run(
    tx,
    `UPDATE courses c
        SET c.lessons_count = (
              SELECT COUNT(*) FROM lessons l
                JOIN course_sections s ON s.id = l.section_id
               WHERE s.course_id = c.id AND l.deleted_at IS NULL
            ),
            c.duration_minutes = COALESCE((
              SELECT ROUND(SUM(v.duration_seconds) / 60)
                FROM lessons l
                JOIN course_sections s ON s.id = l.section_id
                LEFT JOIN videos v ON v.id = l.video_id AND v.deleted_at IS NULL
               WHERE s.course_id = c.id AND l.deleted_at IS NULL
            ), 0)
      WHERE c.id = ?`,
    [courseId]
  );
}

/**
 * Recounts every course a student was enrolled in.
 *
 * Deleting an account revokes its enrolments across many courses at
 * once; each of those courses is now one student lighter. Written as a
 * single correlated UPDATE rather than a loop, because the set is
 * whatever that student had and the database already knows it.
 */
export async function refreshCoursesForUser(userId: string, tx: Runner = null): Promise<void> {
  await run(
    tx,
    `UPDATE courses c
        SET c.students_count = (
          SELECT COUNT(DISTINCT e.user_id) FROM enrollments e
           WHERE e.course_id = c.id
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
        )
      WHERE c.id IN (SELECT course_id FROM enrollments WHERE user_id = ?)`,
    [userId]
  );

  await run(
    tx,
    `UPDATE teachers t
        SET t.students_count = (
          SELECT COUNT(DISTINCT e.user_id)
            FROM enrollments e
            JOIN courses c2 ON c2.id = e.course_id
           WHERE c2.teacher_id = t.id
             AND c2.deleted_at IS NULL
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
        )
      WHERE t.id IN (
        SELECT c3.teacher_id FROM courses c3
         WHERE c3.id IN (SELECT course_id FROM enrollments WHERE user_id = ?)
      )`,
    [userId]
  );
}

/**
 * Recounts one teacher's students.
 *
 * Needed when a COURSE disappears: the course's own counter no longer
 * matters, but the teacher's total does and has just dropped.
 */
export async function refreshTeacherStudents(teacherId: string, tx: Runner = null): Promise<void> {
  await run(
    tx,
    `UPDATE teachers t
        SET t.students_count = (
          SELECT COUNT(DISTINCT e.user_id)
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
           WHERE c.teacher_id = t.id
             AND c.deleted_at IS NULL
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
        )
      WHERE t.id = ?`,
    [teacherId]
  );
}
