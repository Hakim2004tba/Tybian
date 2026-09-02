import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FlatLesson } from "@/lib/video/adjacent-lessons";

export type LearnLesson = {
  id: string;
  title: string;
  sortOrder: number;
  isFreePreview: boolean;
  hasVideo: boolean;
  videoStatus: "processing" | "ready" | "failed" | null;
  durationSeconds: number;
};

export type LearnSection = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: LearnLesson[];
};

export type LearnCourse = {
  id: string;
  slug: string;
  title: string;
  teacherProfileId: string | null;
  teacherName: string | null;
};

/** Course header — deliberately minimal (just what the sidebar/breadcrumb need). */
export async function getLearnCourse(slug: string): Promise<LearnCourse | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, slug, title, teachers ( profile_id, profiles ( full_name ) )")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  const teacherRaw = Array.isArray(data.teachers) ? data.teachers[0] : data.teachers;
  const profileRaw = teacherRaw
    ? (Array.isArray(teacherRaw.profiles) ? teacherRaw.profiles[0] : teacherRaw.profiles)
    : null;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    teacherProfileId: teacherRaw?.profile_id ?? null,
    teacherName: profileRaw?.full_name ?? null,
  };
}

/** Full structure with safe video metadata (duration/status only — see
 *  0015_public_video_info.sql), used to render the sidebar. */
export async function getLearnStructure(courseId: string): Promise<LearnSection[]> {
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
  type VideoInfoRow = { lesson_id: string; duration_seconds: number | null; status: string | null };
  const { data: videoInfo } = lessonIds.length
    ? await supabase.rpc("get_lessons_video_info", { p_lesson_ids: lessonIds })
    : { data: [] as VideoInfoRow[] };

  const videoInfoByLesson = new Map(((videoInfo ?? []) as VideoInfoRow[]).map((v) => [v.lesson_id, v]));

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    sortOrder: section.sort_order,
    lessons: (lessons ?? [])
      .filter((l) => l.section_id === section.id)
      .map((l) => {
        const info = videoInfoByLesson.get(l.id);
        return {
          id: l.id,
          title: l.title,
          sortOrder: l.sort_order,
          isFreePreview: l.is_free_preview,
          hasVideo: !!l.video_id,
          videoStatus: (info?.status as LearnLesson["videoStatus"]) ?? null,
          durationSeconds: info?.duration_seconds ?? 0,
        };
      }),
  }));
}

export function flattenLessons(sections: LearnSection[]): FlatLesson[] {
  return sections.flatMap((s) =>
    s.lessons.map((l) => ({ id: l.id, title: l.title, sectionTitle: s.title, isFreePreview: l.isFreePreview }))
  );
}

export type LessonDetail = {
  id: string;
  title: string;
  description: string | null;
};

export async function getLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select("id, title, description")
    .eq("id", lessonId)
    .maybeSingle();
  return data;
}

export type LessonResource = { id: string; title: string; file_url: string };

export async function getLessonResources(lessonId: string): Promise<LessonResource[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_resources")
    .select("id, title, file_url")
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export type DiscussionComment = {
  id: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
  userId: string;
  profiles: { full_name: string; role: string } | null;
  replies: { id: string; body: string; created_at: string; userId: string; profiles: { full_name: string; role: string } | null }[];
};

export async function getLessonDiscussion(lessonId: string): Promise<DiscussionComment[]> {
  const supabase = await createClient();

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, is_pinned, user_id, profiles ( full_name, role )")
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (!comments?.length) return [];

  const { data: replies } = await supabase
    .from("comment_replies")
    .select("id, comment_id, body, created_at, user_id, profiles ( full_name, role )")
    .in("comment_id", comments.map((c) => c.id))
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return comments.map((c) => {
    const profileRaw = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      is_pinned: c.is_pinned,
      userId: c.user_id,
      profiles: profileRaw ?? null,
      replies: (replies ?? [])
        .filter((r) => r.comment_id === c.id)
        .map((r) => {
          const rProfileRaw = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return { id: r.id, body: r.body, created_at: r.created_at, userId: r.user_id, profiles: rProfileRaw ?? null };
        }),
    };
  });
}

/** Last-watched lesson + position, scoped to ONE course — used to
 *  default the initial ?lesson= selection when a student returns. */
export async function getLastWatchedInCourse(
  userId: string,
  courseId: string
): Promise<{ lessonId: string; positionSeconds: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_student_course_progress", {
    p_user_id: userId,
    p_course_ids: [courseId],
  });
  const row = (data ?? [])[0];
  if (!row?.last_lesson_id) return null;
  return { lessonId: row.last_lesson_id, positionSeconds: row.last_position_seconds ?? 0 };
}
