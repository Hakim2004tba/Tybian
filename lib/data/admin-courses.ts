import "server-only";
import { query, queryOne, toArray, toBool } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";
import type { LessonRowData } from "@/components/admin/courses/LessonRow";

/**
 * Admin course reads.
 *
 * The header on the Supabase version said these went through the admin's
 * own session "so the exact same admin-only RLS policies are what
 * actually gate this data, not this file". This file gates it now:
 * requireAdmin() at the top of every function.
 *
 * That matters most in getCourseStructure(), which returns Bunny and
 * YouTube ids. Those were safe to embed because videos_admin_only kept
 * the table out of reach of anyone else; with no policy, this function
 * is one careless call away from handing playable video ids to a
 * student.
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

export async function listCourses(): Promise<AdminCourseListItem[]> {
  await requireAdmin();

  const rows = await query<{
    id: string;
    slug: string;
    title: string;
    status: AdminCourseListItem["status"];
    level: AdminCourseListItem["level"];
    lessons_count: number;
    videos_count: number;
    duration_minutes: number;
    students_count: number;
    rating: string;
    cover_url: string | null;
    is_featured: number;
    year_name: string | null;
    teacher_profile_id: string | null;
    teacher_name: string | null;
  }>(
    `SELECT c.id, c.slug, c.title, c.status, c.level, c.lessons_count, c.videos_count,
            c.duration_minutes, c.students_count, c.rating, c.cover_url, c.is_featured,
            ay.name_ar   AS year_name,
            t.profile_id AS teacher_profile_id,
            p.full_name  AS teacher_name
       FROM courses c
       LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
       LEFT JOIN teachers t        ON t.id  = c.teacher_id
       LEFT JOIN profiles p        ON p.id  = t.profile_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    level: r.level,
    lessons_count: r.lessons_count,
    videos_count: r.videos_count,
    duration_minutes: r.duration_minutes,
    students_count: r.students_count,
    rating: Number(r.rating),
    cover_url: r.cover_url,
    is_featured: toBool(r.is_featured),
    academic_years: r.year_name ? { name_ar: r.year_name } : null,
    teachers: r.teacher_profile_id
      ? {
          profile_id: r.teacher_profile_id,
          profiles: r.teacher_name ? { full_name: r.teacher_name } : null,
        }
      : null,
  }));
}

export async function getCourseForEdit(courseId: string) {
  await requireAdmin();

  const course = await queryOne<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    short_description: string | null;
    cover_url: string | null;
    tags: unknown;
    learning_outcomes: unknown;
    level: "beginner" | "intermediate" | "advanced";
    status: "draft" | "published" | "archived";
    is_featured: number;
    academic_year_id: string;
    teacher_id: string;
    duration_minutes: number;
    lessons_count: number;
    videos_count: number;
    rating: string;
    rating_count: number;
    students_count: number;
  }>(
    `SELECT id, slug, title, description, short_description, cover_url, tags,
            learning_outcomes, level, status, is_featured, academic_year_id, teacher_id,
            duration_minutes, lessons_count, videos_count, rating, rating_count, students_count
       FROM courses WHERE id = ? AND deleted_at IS NULL`,
    [courseId]
  );

  if (!course) return null;

  const prices = await query<{
    id: string;
    plan_type: string;
    price: string;
    currency: string;
    duration_days: number | null;
    is_active: number;
  }>(
    `SELECT id, plan_type, price, currency, duration_days, is_active
       FROM course_prices WHERE course_id = ?`,
    [courseId]
  );

  return {
    ...course,
    tags: toArray<string>(course.tags),
    learning_outcomes: toArray<string>(course.learning_outcomes),
    is_featured: toBool(course.is_featured),
    rating: Number(course.rating),
    course_prices: prices.map((p) => ({
      id: p.id,
      plan_type: p.plan_type,
      price: Number(p.price),
      currency: p.currency,
      duration_days: p.duration_days === null ? null : Number(p.duration_days),
      is_active: toBool(p.is_active),
    })),
  };
}

export async function getCourseStructure(courseId: string) {
  await requireAdmin();

  // Provider ids ARE selected here — the admin editor needs them to show
  // which video is attached, and the Vimeo hash to preview an unlisted
  // one. This is the only read in the app that returns them outside the
  // playback resolver, and requireAdmin() above is what keeps it so.
  const rows = await query<{
    section_id: string;
    section_title: string;
    section_order: number;
    lesson_id: string | null;
    lesson_title: string | null;
    lesson_order: number | null;
    is_free_preview: number | null;
    video_id: string | null;
    v_id: string | null;
    v_source: string | null;
    v_vimeo: string | null;
    v_vimeo_hash: string | null;
    v_youtube: string | null;
    v_title: string | null;
    v_thumb: string | null;
    v_duration: number | null;
    v_status: string | null;
  }>(
    `SELECT s.id AS section_id, s.title AS section_title, s.sort_order AS section_order,
            l.id AS lesson_id, l.title AS lesson_title, l.sort_order AS lesson_order,
            l.is_free_preview, l.video_id,
            v.id AS v_id, v.source AS v_source,
            v.vimeo_video_id AS v_vimeo, v.vimeo_hash AS v_vimeo_hash,
            v.youtube_video_id AS v_youtube, v.title AS v_title,
            v.thumbnail_url AS v_thumb, v.duration_seconds AS v_duration, v.status AS v_status
       FROM course_sections s
       LEFT JOIN lessons l ON l.section_id = s.id AND l.deleted_at IS NULL
       LEFT JOIN videos  v ON v.id = l.video_id
      WHERE s.course_id = ? AND s.deleted_at IS NULL
      ORDER BY s.sort_order ASC, l.sort_order ASC`,
    [courseId]
  );

  const sections = new Map<
    string,
    { id: string; title: string; sort_order: number; lessons: LessonRowData[] }
  >();

  for (const r of rows) {
    if (!sections.has(r.section_id)) {
      sections.set(r.section_id, {
        id: r.section_id,
        title: r.section_title,
        sort_order: r.section_order,
        lessons: [],
      });
    }
    if (r.lesson_id === null) continue;

    sections.get(r.section_id)!.lessons.push({
      id: r.lesson_id,
      title: r.lesson_title ?? "",
      is_free_preview: toBool(r.is_free_preview),
      video_id: r.video_id,
      videos: r.v_id
        ? {
            id: r.v_id,
            source: (r.v_source ?? "vimeo") as "youtube" | "vimeo",
            vimeo_video_id: r.v_vimeo,
            vimeo_hash: r.v_vimeo_hash,
            youtube_video_id: r.v_youtube,
            title: r.v_title ?? "",
            thumbnail_url: r.v_thumb,
            duration_seconds: r.v_duration ?? 0,
            status: r.v_status ?? "processing",
          }
        : null,
    });
  }

  return [...sections.values()];
}

export async function listTeachers() {
  await requireAdmin();

  return query<{ id: string; title: string | null; full_name: string | null }>(
    `SELECT t.id, t.title, p.full_name
       FROM teachers t
       LEFT JOIN profiles p ON p.id = t.profile_id
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC`
  ).then((rows) =>
    rows.map((t) => ({
      id: t.id,
      title: t.title,
      profiles: t.full_name ? { full_name: t.full_name } : null,
    }))
  );
}

export async function listAcademicYears() {
  await requireAdmin();

  return query<{ id: string; name_ar: string; year_number: number }>(
    `SELECT id, name_ar, year_number FROM academic_years ORDER BY sort_order ASC`
  );
}
