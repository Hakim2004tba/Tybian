import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * All reads here go through the caller's authenticated (admin) session,
 * not service_role — so the exact same admin-only RLS policies from
 * 0009_rls_policies.sql are what actually gate this data, not this file.
 */

export type AdminCourseListItem = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived";
  level: "beginner" | "intermediate" | "advanced";
  lessons_count: number;
  videos_count: number;
  duration_minutes: number;
  students_count: number;
  rating: number;
  cover_url: string | null;
  is_featured: boolean;
  academic_years: { name_ar: string } | null;
  teachers: { profile_id: string; profiles: { full_name: string } | null } | null;
};

export async function listCourses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      `id, slug, title, status, level, lessons_count, videos_count, duration_minutes,
       students_count, rating, cover_url, is_featured,
       academic_years ( name_ar ),
       teachers ( profile_id, profiles ( full_name ) )`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminCourseListItem[];
}

export async function getCourseForEdit(courseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      `id, slug, title, description, short_description, cover_url, tags, learning_outcomes, level, status, is_featured,
       academic_year_id, teacher_id, duration_minutes, lessons_count, videos_count,
       rating, rating_count, students_count,
       course_prices ( id, plan_type, price, currency, is_active )`
    )
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCourseStructure(courseId: string) {
  const supabase = await createClient();

  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (sectionsError) throw new Error(sectionsError.message);
  if (!sections?.length) return [];

  // Nested `select()` filters can't reach into an embedded resource's own
  // columns (e.g. excluding soft-deleted lessons), so lessons are fetched
  // as a separate, explicitly-filtered query and merged here instead of
  // relying on a single joined query that would silently include
  // soft-deleted rows. `videos` IS safe to embed directly here (unlike a
  // hypothetical student-facing query) because this whole function only
  // ever runs behind requireRouteAccess("/admin") — the admin's own
  // session satisfies `videos_admin_only` RLS on its own merit.
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select(
      `id, section_id, title, sort_order, is_free_preview, video_id,
       videos ( id, source, bunny_video_id, youtube_video_id, title, thumbnail_url, duration_seconds, status )`
    )
    .in("section_id", sections.map((s) => s.id))
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (lessonsError) throw new Error(lessonsError.message);

  // Without generated Supabase types, the client infers `videos` as an
  // array for any embedded relation — but lessons.video_id is a to-one
  // FK, so there's ever at most one row. Normalize it here rather than
  // pushing `[0]` access into every consumer.
  const normalizedLessons = (lessons ?? []).map((l) => ({
    ...l,
    videos: Array.isArray(l.videos) ? (l.videos[0] ?? null) : l.videos,
  }));

  return sections.map((section) => ({
    ...section,
    lessons: normalizedLessons.filter((l) => l.section_id === section.id),
  }));
}

export async function listTeachers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, title, profiles ( full_name )")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as {
    id: string;
    title: string | null;
    profiles: { full_name: string } | null;
  }[];
}

export async function listAcademicYears() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name_ar, year_number")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
