import "server-only";
import { query, queryOne, toBool } from "@/lib/db";
import type { FlatLesson } from "@/lib/video/adjacent-lessons";

/**
 * Reads for the lesson player.
 *
 * Nothing in this file decides whether the student may WATCH anything —
 * that is decideVideoAccess(), fed by lib/video/get-access-facts.ts, on
 * the playback route. What is here is the surrounding page: the outline,
 * the lesson text, the attached files, the discussion.
 *
 * Which is exactly why the video metadata selected below stays limited to
 * duration and status. The sidebar renders for anyone who reaches the
 * page, enrolled or not, and a provider id in that payload would be a
 * playable link that never passes the gate at all. 0015 made this a
 * SECURITY DEFINER function for that reason; with no RLS the restriction
 * has to be kept by hand, in the SELECT list.
 */

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
  const row = await queryOne<{
    id: string;
    slug: string;
    title: string;
    teacher_profile_id: string | null;
    teacher_name: string | null;
  }>(
    `SELECT c.id, c.slug, c.title,
            t.profile_id AS teacher_profile_id,
            p.full_name  AS teacher_name
       FROM courses c
       LEFT JOIN teachers t ON t.id = c.teacher_id
       LEFT JOIN profiles p ON p.id = t.profile_id
      WHERE c.slug = ? AND c.deleted_at IS NULL`,
    [slug]
  );

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    teacherProfileId: row.teacher_profile_id,
    teacherName: row.teacher_name,
  };
}

/** Full structure with safe video metadata (duration/status only). */
export async function getLearnStructure(courseId: string): Promise<LearnSection[]> {
  try {
    // One query, three round trips saved — and note again which columns
    // of `videos` appear: duration_seconds and status. Never an id.
    const rows = await query<{
      section_id: string;
      section_title: string;
      section_order: number;
      lesson_id: string | null;
      lesson_title: string | null;
      lesson_order: number | null;
      is_free_preview: number | null;
      video_id: string | null;
      duration_seconds: number | null;
      video_status: LearnLesson["videoStatus"];
    }>(
      `SELECT s.id         AS section_id,
              s.title      AS section_title,
              s.sort_order AS section_order,
              l.id         AS lesson_id,
              l.title      AS lesson_title,
              l.sort_order AS lesson_order,
              l.is_free_preview,
              l.video_id,
              v.duration_seconds,
              v.status     AS video_status
         FROM course_sections s
         LEFT JOIN lessons l ON l.section_id = s.id AND l.deleted_at IS NULL
         LEFT JOIN videos  v ON v.id = l.video_id AND v.deleted_at IS NULL
        WHERE s.course_id = ? AND s.deleted_at IS NULL
        ORDER BY s.sort_order ASC, l.sort_order ASC`,
      [courseId]
    );

    const sections = new Map<string, LearnSection>();

    for (const row of rows) {
      if (!sections.has(row.section_id)) {
        sections.set(row.section_id, {
          id: row.section_id,
          title: row.section_title,
          sortOrder: row.section_order,
          lessons: [],
        });
      }

      // An empty section arrives as one all-null lesson row and must
      // still show in the outline.
      if (row.lesson_id === null) continue;

      sections.get(row.section_id)!.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title ?? "",
        sortOrder: row.lesson_order ?? 0,
        isFreePreview: toBool(row.is_free_preview),
        hasVideo: row.video_id !== null,
        videoStatus: row.video_status ?? null,
        durationSeconds: row.duration_seconds ?? 0,
      });
    }

    return [...sections.values()];
  } catch {
    return [];
  }
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
  // `deleted_at IS NULL` added: the Supabase query did not filter it, so
  // a removed lesson still returned its title and description to anyone
  // holding the id.
  return queryOne<LessonDetail>(
    `SELECT id, title, description FROM lessons WHERE id = ? AND deleted_at IS NULL`,
    [lessonId]
  );
}

export type LessonResource = { id: string; title: string; file_url: string };

export async function getLessonResources(lessonId: string): Promise<LessonResource[]> {
  try {
    return await query<LessonResource>(
      `SELECT id, title, file_url
         FROM lesson_resources
        WHERE lesson_id = ? AND deleted_at IS NULL
        ORDER BY sort_order ASC`,
      [lessonId]
    );
  } catch {
    return [];
  }
}

export type DiscussionComment = {
  id: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
  userId: string;
  profiles: { full_name: string; role: string } | null;
  replies: {
    id: string;
    body: string;
    created_at: string;
    userId: string;
    profiles: { full_name: string; role: string } | null;
  }[];
};

export async function getLessonDiscussion(lessonId: string): Promise<DiscussionComment[]> {
  try {
    const comments = await query<{
      id: string;
      body: string;
      created_at: string;
      is_pinned: number;
      user_id: string;
      full_name: string | null;
      role: string | null;
    }>(
      `SELECT c.id, c.body, c.created_at, c.is_pinned, c.user_id,
              p.full_name, p.role
         FROM comments c
         LEFT JOIN profiles p ON p.id = c.user_id
        WHERE c.lesson_id = ? AND c.deleted_at IS NULL
        ORDER BY c.is_pinned DESC, c.created_at DESC
        LIMIT 20`,
      [lessonId]
    );

    if (!comments.length) return [];

    const placeholders = comments.map(() => "?").join(",");
    const replies = await query<{
      id: string;
      comment_id: string;
      body: string;
      created_at: string;
      user_id: string;
      full_name: string | null;
      role: string | null;
    }>(
      `SELECT r.id, r.comment_id, r.body, r.created_at, r.user_id,
              p.full_name, p.role
         FROM comment_replies r
         LEFT JOIN profiles p ON p.id = r.user_id
        WHERE r.comment_id IN (${placeholders}) AND r.deleted_at IS NULL
        ORDER BY r.created_at ASC`,
      comments.map((c) => c.id)
    );

    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      is_pinned: toBool(c.is_pinned),
      userId: c.user_id,
      profiles: c.full_name ? { full_name: c.full_name, role: c.role ?? "student" } : null,
      replies: replies
        .filter((r) => r.comment_id === c.id)
        .map((r) => ({
          id: r.id,
          body: r.body,
          created_at: r.created_at,
          userId: r.user_id,
          profiles: r.full_name ? { full_name: r.full_name, role: r.role ?? "student" } : null,
        })),
    }));
  } catch {
    return [];
  }
}

/**
 * Last-watched lesson and position within ONE course, used to default
 * the initial ?lesson= selection when a student returns.
 *
 * Was the get_student_course_progress() RPC, which answered this for a
 * list of courses at once. Only ever called with a single course, so it
 * is written here as the query it always was.
 *
 * `userId` is passed in rather than read from the session because the
 * caller has already resolved it — but it is still bound to the WHERE
 * clause, so this can only ever return that person's own position.
 */
export async function getLastWatchedInCourse(
  userId: string,
  courseId: string
): Promise<{ lessonId: string; positionSeconds: number } | null> {
  const row = await queryOne<{ lesson_id: string; last_position_seconds: number }>(
    `SELECT lp.lesson_id, lp.last_position_seconds
       FROM lesson_progress lp
       JOIN lessons l         ON l.id = lp.lesson_id AND l.deleted_at IS NULL
       JOIN course_sections s ON s.id = l.section_id AND s.deleted_at IS NULL
      WHERE lp.user_id = ? AND s.course_id = ?
      ORDER BY lp.updated_at DESC
      LIMIT 1`,
    [userId, courseId]
  );

  if (!row) return null;
  return { lessonId: row.lesson_id, positionSeconds: row.last_position_seconds ?? 0 };
}
