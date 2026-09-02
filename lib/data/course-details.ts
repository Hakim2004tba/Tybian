import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/**
 * All queries here run through the CALLER's own session (guest/student/
 * teacher/admin) — visibility is entirely governed by the RLS policies
 * from 0009_rls_policies.sql (published courses are public; drafts only
 * visible to their owning teacher or an admin). This file adds no
 * additional access logic of its own except where explicitly noted
 * (video metadata, which goes through the get_lessons_video_info
 * SECURITY DEFINER function from 0015 rather than the admin-only
 * `videos` table directly).
 */

export type CourseDetails = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  short_description: string | null;
  cover_url: string | null;
  tags: string[];
  learning_outcomes: string[];
  level: "beginner" | "intermediate" | "advanced";
  status: "draft" | "published" | "archived";
  duration_minutes: number;
  lessons_count: number;
  videos_count: number;
  rating: number;
  rating_count: number;
  students_count: number;
  academic_years: { name_ar: string } | null;
  teachers: {
    id: string;
    title: string | null;
    bio: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
};

export async function getCourseBySlug(slug: string): Promise<CourseDetails | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      `id, slug, title, description, short_description, cover_url, tags, learning_outcomes,
       level, status, duration_minutes, lessons_count, videos_count, rating, rating_count, students_count,
       academic_years ( name_ar ),
       teachers ( id, title, bio, profiles ( full_name, avatar_url ) )`
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  // Same defensive normalization as getCourseStructureForStudent's
  // `videos` handling: without generated Supabase types, the client's
  // TS inference can't always be trusted to match PostgREST's actual
  // to-one cardinality, so this handles either shape safely rather than
  // relying on a blind type cast.
  const raw = data as unknown as Record<string, unknown>;
  const academicYears = Array.isArray(raw.academic_years) ? raw.academic_years[0] ?? null : raw.academic_years;
  const teachersRaw = Array.isArray(raw.teachers) ? raw.teachers[0] ?? null : raw.teachers;
  const teachers = teachersRaw
    ? {
        ...(teachersRaw as Record<string, unknown>),
        profiles: Array.isArray((teachersRaw as Record<string, unknown>).profiles)
          ? ((teachersRaw as Record<string, unknown>).profiles as unknown[])[0] ?? null
          : (teachersRaw as Record<string, unknown>).profiles,
      }
    : null;

  return {
    ...(raw as object),
    academic_years: academicYears,
    teachers,
  } as CourseDetails;
}

export type LessonWithVideoInfo = {
  id: string;
  title: string;
  sort_order: number;
  is_free_preview: boolean;
  hasVideo: boolean;
  durationSeconds: number;
  videoStatus: "processing" | "ready" | "failed" | null;
};

export type CourseSectionWithLessons = {
  id: string;
  title: string;
  sort_order: number;
  lessons: LessonWithVideoInfo[];
};

export async function getCourseStructureForStudent(
  courseId: string
): Promise<CourseSectionWithLessons[]> {
  const supabase = await createClient();

  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (!sections?.length) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, section_id, title, sort_order, is_free_preview, video_id")
    .in("section_id", sections.map((s) => s.id))
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const lessonIds = (lessons ?? []).map((l) => l.id);

  // Safe video metadata (duration/status) via the SECURITY DEFINER
  // function — never a direct read of the admin-only `videos` table.
  // See 0015_public_video_info.sql.
  type VideoInfoRow = { lesson_id: string; duration_seconds: number | null; status: string | null };
  const { data: videoInfo } = lessonIds.length
    ? await supabase.rpc("get_lessons_video_info", { p_lesson_ids: lessonIds })
    : { data: [] as VideoInfoRow[] };

  const videoInfoByLesson = new Map(
    ((videoInfo ?? []) as VideoInfoRow[]).map((v) => [v.lesson_id, v])
  );

  return sections.map((section) => ({
    ...section,
    lessons: (lessons ?? [])
      .filter((l) => l.section_id === section.id)
      .map((l) => {
        const info = videoInfoByLesson.get(l.id);
        return {
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          is_free_preview: l.is_free_preview,
          hasVideo: !!l.video_id,
          durationSeconds: info?.duration_seconds ?? 0,
          videoStatus: (info?.status as LessonWithVideoInfo["videoStatus"]) ?? null,
        };
      }),
  }));
}

export type StudentAccessState = {
  isAuthenticated: boolean;
  hasAccess: boolean;
  hasLifetimeAccess: boolean;
  planType: "three_months" | "lifetime" | null;
  progressByLessonId: Map<string, { isCompleted: boolean; lastPositionSeconds: number }>;
};

export async function getStudentAccessState(
  courseId: string,
  lessonIds: string[]
): Promise<StudentAccessState> {
  const user = await getSessionUser();
  const empty: StudentAccessState = {
    isAuthenticated: false,
    hasAccess: false,
    hasLifetimeAccess: false,
    planType: null,
    progressByLessonId: new Map(),
  };
  if (!user) return empty;

  const supabase = await createClient();

  // enrollments_select_own_or_admin RLS means this can only ever return
  // the caller's own row (or, for an admin, any row — irrelevant here
  // since this function is only meaningful for the viewing student).
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("plan_type, expires_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasAccess =
    !!enrollment && (enrollment.expires_at === null || new Date(enrollment.expires_at) > new Date());

  const progressByLessonId = new Map<string, { isCompleted: boolean; lastPositionSeconds: number }>();
  if (lessonIds.length) {
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id, is_completed, last_position_seconds")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds);

    (progress ?? []).forEach((p) => {
      progressByLessonId.set(p.lesson_id, {
        isCompleted: p.is_completed,
        lastPositionSeconds: p.last_position_seconds,
      });
    });
  }

  return {
    isAuthenticated: true,
    hasAccess,
    hasLifetimeAccess: hasAccess && enrollment?.plan_type === "lifetime",
    planType: hasAccess ? (enrollment!.plan_type as "three_months" | "lifetime") : null,
    progressByLessonId,
  };
}

export type CoursePricing = { planType: "three_months" | "lifetime"; price: number; currency: string }[];

export async function getCoursePricing(courseId: string): Promise<CoursePricing> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_prices")
    .select("plan_type, price, currency")
    .eq("course_id", courseId)
    .eq("is_active", true);

  return (data ?? []).map((p) => ({
    planType: p.plan_type as "three_months" | "lifetime",
    price: Number(p.price),
    currency: p.currency,
  }));
}
