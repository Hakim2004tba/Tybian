import "server-only";
import { query, queryOne, toArray, toBool } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { canViewCourse } from "@/lib/db/guard";

/**
 * Course detail reads.
 *
 * The Supabase version of this file opened with a note saying visibility
 * was "entirely governed by the RLS policies from 0009" and that it added
 * no access logic of its own. That is precisely what has to change: there
 * are no policies now, so every rule those policies expressed is written
 * out here.
 *
 * Two of them mattered and are marked at the point they apply:
 *
 *   - a draft or archived course is visible only to its owning teacher
 *     and to admins (`canViewCourse`);
 *   - the `videos` table was admin-only and reachable solely through the
 *     SECURITY DEFINER function get_lessons_video_info() from 0015, which
 *     returned duration and status but never a provider id.
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

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  short_description: string | null;
  cover_url: string | null;
  tags: unknown;
  learning_outcomes: unknown;
  level: CourseDetails["level"];
  status: CourseDetails["status"];
  duration_minutes: number;
  lessons_count: number;
  videos_count: number;
  rating: string;
  rating_count: number;
  students_count: number;
  year_name: string | null;
  teacher_id: string | null;
  teacher_title: string | null;
  teacher_bio: string | null;
  teacher_name: string | null;
  teacher_avatar: string | null;
};

export async function getCourseBySlug(slug: string): Promise<CourseDetails | null> {
  const row = await queryOne<CourseRow>(
    `SELECT c.id, c.slug, c.title, c.description, c.short_description, c.cover_url,
            c.tags, c.learning_outcomes, c.level, c.status,
            c.duration_minutes, c.lessons_count, c.videos_count,
            c.rating, c.rating_count, c.students_count,
            ay.name_ar    AS year_name,
            t.id          AS teacher_id,
            t.title       AS teacher_title,
            t.bio         AS teacher_bio,
            p.full_name   AS teacher_name,
            p.avatar_url  AS teacher_avatar
       FROM courses c
       LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
       LEFT JOIN teachers t        ON t.id  = c.teacher_id
       LEFT JOIN profiles p        ON p.id  = t.profile_id
      WHERE c.slug = ? AND c.deleted_at IS NULL`,
    [slug]
  );

  if (!row) return null;

  /*
    THE check this file used to get from RLS.

    `courses_select_published_or_own` made a draft invisible to everyone
    but its owning teacher and admins. Without it, this function would
    happily return an unpublished course to any visitor who guessed the
    slug — and course slugs are guessable, because they are derived from
    the title. Returning null rather than throwing keeps the old
    contract: the page renders its 404.
  */
  if (!(await canViewCourse(row.id))) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    short_description: row.short_description,
    cover_url: row.cover_url,
    tags: toArray<string>(row.tags),
    learning_outcomes: toArray<string>(row.learning_outcomes),
    level: row.level,
    status: row.status,
    duration_minutes: row.duration_minutes,
    lessons_count: row.lessons_count,
    videos_count: row.videos_count,
    rating: Number(row.rating),
    rating_count: row.rating_count,
    students_count: row.students_count,
    academic_years: row.year_name ? { name_ar: row.year_name } : null,
    teachers: row.teacher_id
      ? {
          id: row.teacher_id,
          title: row.teacher_title,
          bio: row.teacher_bio,
          profiles: row.teacher_name
            ? { full_name: row.teacher_name, avatar_url: row.teacher_avatar }
            : null,
        }
      : null,
  };
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

type StructureRow = {
  section_id: string;
  section_title: string;
  section_order: number;
  lesson_id: string | null;
  lesson_title: string | null;
  lesson_order: number | null;
  is_free_preview: number | null;
  video_id: string | null;
  duration_seconds: number | null;
  video_status: LessonWithVideoInfo["videoStatus"];
};

export async function getCourseStructureForStudent(
  courseId: string
): Promise<CourseSectionWithLessons[]> {
  /*
    One query where there were three (sections, lessons, then an RPC for
    video info). The RPC existed only because `videos` was admin-only
    under RLS and a direct join would have been refused; with no RLS the
    join is available, so the restriction it enforced has to be kept by
    hand instead.

    Note exactly which video columns are selected: duration_seconds and
    status. NOT bunny_video_id, bunny_library_id or youtube_video_id.
    That is the whole point of get_lessons_video_info() in 0015 — the
    player needs to know a video is ready and how long it is, and a
    provider id in a public payload is a link anyone can play without
    paying. Do not widen this SELECT.
  */
  try {
    const rows = await query<StructureRow>(
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

    const sections = new Map<string, CourseSectionWithLessons>();

    for (const row of rows) {
      if (!sections.has(row.section_id)) {
        sections.set(row.section_id, {
          id: row.section_id,
          title: row.section_title,
          sort_order: row.section_order,
          lessons: [],
        });
      }

      // The LEFT JOIN yields one all-null lesson row for an empty
      // section, which must still appear in the outline.
      if (row.lesson_id === null) continue;

      sections.get(row.section_id)!.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title ?? "",
        sort_order: row.lesson_order ?? 0,
        is_free_preview: toBool(row.is_free_preview),
        hasVideo: row.video_id !== null,
        durationSeconds: row.duration_seconds ?? 0,
        videoStatus: row.video_status ?? null,
      });
    }

    return [...sections.values()];
  } catch {
    return [];
  }
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

  /*
    The enrollment test is the same three conditions as
    hasActiveEnrollment() in the guard — not deleted, started, not
    expired — evaluated in SQL so the clock is the database's.

    `user_id = ?` matters more than it looks. The Supabase version could
    lean on enrollments_select_own_or_admin to make a missing filter
    harmless; here, dropping it would return somebody else's enrollment
    and hand this student the course.

    One deliberate difference from the old code: `starts_at <= now` is
    included. The RLS-era query omitted it, so an admin-granted
    enrollment dated to the future counted as active immediately. The
    database function it was supposed to mirror always tested it.
  */
  const enrollment = await queryOne<{ plan_type: "three_months" | "lifetime" }>(
    `SELECT plan_type
       FROM enrollments
      WHERE user_id = ?
        AND course_id = ?
        AND deleted_at IS NULL
        AND starts_at <= UTC_TIMESTAMP(3)
        AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
      ORDER BY created_at DESC
      LIMIT 1`,
    [user.id, courseId]
  );

  const hasAccess = enrollment !== null;

  const progressByLessonId = new Map<string, { isCompleted: boolean; lastPositionSeconds: number }>();

  if (lessonIds.length) {
    // An IN list of unknown length cannot be a single placeholder, so
    // build one `?` per id — still fully parameterised, no interpolation.
    const placeholders = lessonIds.map(() => "?").join(",");
    const progress = await query<{
      lesson_id: string;
      is_completed: number;
      last_position_seconds: number;
    }>(
      `SELECT lesson_id, is_completed, last_position_seconds
         FROM lesson_progress
        WHERE user_id = ? AND lesson_id IN (${placeholders})`,
      [user.id, ...lessonIds]
    );

    for (const p of progress) {
      progressByLessonId.set(p.lesson_id, {
        isCompleted: toBool(p.is_completed),
        lastPositionSeconds: p.last_position_seconds,
      });
    }
  }

  return {
    isAuthenticated: true,
    hasAccess,
    hasLifetimeAccess: hasAccess && enrollment!.plan_type === "lifetime",
    planType: hasAccess ? enrollment!.plan_type : null,
    progressByLessonId,
  };
}

export type CoursePricing = {
  planType: "three_months" | "lifetime";
  price: number;
  currency: string;
  /** Days the plan lasts; null is lifetime. Set per course by an admin. */
  durationDays: number | null;
}[];

export async function getCoursePricing(courseId: string): Promise<CoursePricing> {
  try {
    const rows = await query<{
      plan_type: "three_months" | "lifetime";
      price: string;
      currency: string;
      duration_days: number | null;
    }>(
      `SELECT plan_type, price, currency, duration_days
         FROM course_prices
        WHERE course_id = ? AND is_active = 1`,
      [courseId]
    );

    return rows.map((p) => ({
      planType: p.plan_type,
      // DECIMAL arrives as a string to protect the cents; the display
      // type is a number.
      price: Number(p.price),
      currency: p.currency,
      /*
        What the student is actually buying.
        --------------------------------------------------------------
        The stored number, whatever slot it sits in. NULL means
        lifetime — for BOTH slots, because 10-plan-duration.sql set
        every existing row explicitly (90 for the limited slot, NULL
        for the other), so a NULL here after that migration can only
        come from an admin deliberately choosing "مدى الحياة".

        The previous version forced `plan_type === "lifetime"` to read
        as lifetime regardless of the stored value — a leftover from
        the design where the second slot was permanently "forever".
        That is exactly the assumption this feature exists to remove,
        and it meant an admin could set the second plan to six months,
        see it saved, and watch the course page keep saying "مدى
        الحياة". The slot's NAME is not its length.
      */
      durationDays: p.duration_days === null ? null : Number(p.duration_days),
    }));
  } catch (error) {
    /*
      Not silent. The most likely cause is 10-plan-duration.sql never
      having been run, and an empty pricing panel with no explanation
      sent the last diagnosis hunting through the wrong layer.
    */
    console.error("[pricing] could not read course_prices:", (error as Error).message);
    return [];
  }
}
