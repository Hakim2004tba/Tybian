import "server-only";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";
import { getProgressForCourses } from "@/lib/data/student-dashboard";

/**
 * One student's record, for the admin student page.
 *
 * requireAdmin() is doing real work in this file. Every function here
 * takes a `userId` that is NOT the caller's — that is the whole point —
 * so without the check these would read any student's enrolments,
 * progress and activity for anyone who could call them. The RLS
 * admin-bypass clauses used to make that safe; nothing does now.
 */

export type StudentDetail = {
  id: string;
  fullName: string;
  phone: string | null;
  academicYearName: string | null;
  createdAt: string;
};

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  await requireAdmin();

  const row = await queryOne<{
    id: string;
    full_name: string;
    phone: string | null;
    created_at: string;
    year_name: string | null;
  }>(
    `SELECT p.id, p.full_name, p.phone, p.created_at, ay.name_ar AS year_name
       FROM profiles p
       LEFT JOIN academic_years ay ON ay.id = p.academic_year_id
      WHERE p.id = ? AND p.role = 'student'`,
    [userId]
  );

  if (!row) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    academicYearName: row.year_name,
    createdAt: row.created_at,
  };
}

export type StudentEnrollment = {
  courseId: string;
  courseTitle: string;
  planType: string;
  /* Both ends, so the admin view can state the length this enrolment
     actually granted rather than guessing it from the slot name. */
  startsAt: string | null;
  expiresAt: string | null;
  totalLessons: number;
  completedLessons: number;
  lastLessonTitle: string | null;
  lastSectionTitle: string | null;
  lastActivityAt: string | null;
};

export async function getStudentEnrollments(userId: string): Promise<StudentEnrollment[]> {
  await requireAdmin();

  const enrollments = await query<{
    course_id: string;
    plan_type: string;
    starts_at: string | null;
    expires_at: string | null;
    course_title: string | null;
  }>(
    `SELECT e.course_id, e.plan_type, e.starts_at, e.expires_at, c.title AS course_title
       FROM enrollments e
       LEFT JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ? AND e.deleted_at IS NULL
      ORDER BY e.created_at DESC`,
    [userId]
  );

  if (!enrollments.length) return [];

  /*
    Reuses getProgressForCourses(), which is the same computation
    /dashboard uses — get_student_course_progress() served both before,
    and keeping one implementation means the admin's view of a student's
    progress cannot drift from the student's own.

    Note it only reports on currently-active enrolments, so an expired
    course lists with zeroed progress rather than its last known state.
    The RPC behaved the same way.
  */
  const progress = await getProgressForCourses(
    userId,
    enrollments.map((e) => e.course_id)
  );
  const byCourse = new Map(progress.map((p) => [p.course_id, p]));

  return enrollments.map((e) => {
    const p = byCourse.get(e.course_id);
    return {
      courseId: e.course_id,
      courseTitle: e.course_title ?? "دورة محذوفة",
      planType: e.plan_type,
      startsAt: e.starts_at,
      expiresAt: e.expires_at,
      totalLessons: p?.total_lessons ?? 0,
      completedLessons: p?.completed_lessons ?? 0,
      lastLessonTitle: p?.last_lesson_title ?? null,
      lastSectionTitle: p?.last_section_title ?? null,
      lastActivityAt: p?.last_activity_at ?? null,
    };
  });
}

export type StudentActivityRow = { id: string; activity_type: string; created_at: string };

export async function getStudentRecentActivity(userId: string): Promise<StudentActivityRow[]> {
  await requireAdmin();

  return query<StudentActivityRow>(
    `SELECT id, activity_type, created_at
       FROM student_activity
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10`,
    [userId]
  );
}
