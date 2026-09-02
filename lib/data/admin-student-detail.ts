import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StudentDetail = {
  id: string;
  fullName: string;
  phone: string | null;
  academicYearName: string | null;
  createdAt: string;
};

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, created_at, academic_years ( name_ar )")
    .eq("id", userId)
    .eq("role", "student")
    .maybeSingle();

  if (!data) return null;
  const yearRaw = Array.isArray(data.academic_years) ? data.academic_years[0] : data.academic_years;

  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    academicYearName: yearRaw?.name_ar ?? null,
    createdAt: data.created_at,
  };
}

export type StudentEnrollment = {
  courseId: string;
  courseTitle: string;
  planType: string;
  expiresAt: string | null;
  totalLessons: number;
  completedLessons: number;
  lastLessonTitle: string | null;
  lastSectionTitle: string | null;
  lastActivityAt: string | null;
};

/** Bounded to ONE student's own enrollments — cheap, no caching needed
 *  (see 0022_analytics_snapshots.sql's design-decision comment). Reuses
 *  get_student_course_progress(), the same function /dashboard uses,
 *  called here with an admin session (RLS's admin-bypass clauses on
 *  enrollments/lesson_progress make this see the target student's real
 *  data, not the admin's own). */
export async function getStudentEnrollments(userId: string): Promise<StudentEnrollment[]> {
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, plan_type, expires_at, courses ( title )")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!enrollments?.length) return [];

  type ProgressRow = {
    course_id: string;
    total_lessons: number;
    completed_lessons: number;
    last_lesson_title: string | null;
    last_section_title: string | null;
    last_activity_at: string | null;
  };
  const { data: progress } = await supabase.rpc("get_student_course_progress", { p_user_id: userId });
  const progressByCourse = new Map(((progress ?? []) as ProgressRow[]).map((p) => [p.course_id, p]));

  return enrollments.map((e) => {
    const courseRaw = Array.isArray(e.courses) ? e.courses[0] : e.courses;
    const p = progressByCourse.get(e.course_id);
    return {
      courseId: e.course_id,
      courseTitle: courseRaw?.title ?? "دورة محذوفة",
      planType: e.plan_type,
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_activity")
    .select("id, activity_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}
