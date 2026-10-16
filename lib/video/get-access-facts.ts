import "server-only";
import { queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasActiveEnrollment } from "@/lib/db/guard";
import type { VideoAccessFacts } from "@/lib/video/access";

export type LessonForPlayback = {
  id: string;
  videoId: string | null;
  isFreePreview: boolean;
  courseId: string;
};

/**
 * Gathers every fact decideVideoAccess() needs, so the Route Handler
 * stays a thin "gather facts → decide → act" pipeline.
 *
 * decideVideoAccess() itself is untouched by this port: it was already a
 * pure function with its own unit tests, and it still holds the ordering
 * of the checks. Only the fact-gathering moved, because that half was
 * Supabase's job.
 *
 * This is the gate in front of paid video. Two things about it are worth
 * saying plainly, because the safety net that used to sit behind them is
 * gone:
 *
 *   1. Under RLS, a mistake here was usually contained — the caller's own
 *      policies still applied to whatever this function read. There is no
 *      second line now. Whatever this returns, decideVideoAccess()
 *      believes.
 *
 *   2. `isActivelyEnrolled` used to come from the has_active_enrollment()
 *      RPC, so "is this enrollment currently valid" lived in exactly one
 *      place. It still does — hasActiveEnrollment() in lib/db/guard.ts —
 *      and this file calls it rather than writing the three conditions
 *      out again. Do not inline them here.
 */
export async function getLessonAccessFacts(lessonId: string): Promise<{
  facts: VideoAccessFacts;
  lesson: LessonForPlayback | null;
}> {
  const user = await getSessionUser();
  const isAdmin = user?.role === "admin";

  /*
    One query up through the hierarchy: lesson → section → course →
    teacher → the teacher's profile id.

    `t.profile_id` is what identifies the owning teacher, not
    `c.teacher_id` — courses point at a teachers row, and teachers point
    at a profile. Comparing the user id to c.teacher_id would never match
    and would silently lock every teacher out of their own drafts.

    No `status` filter in the WHERE clause on purpose: whether a
    non-published course is viewable is decideVideoAccess()'s call, and
    it needs the status to make it. Filtering here would collapse
    "course is a draft" into "lesson does not exist" and change the
    message the owning teacher sees.
  */
  const row = await queryOne<{
    lesson_id: string;
    video_id: string | null;
    is_free_preview: number;
    course_id: string;
    course_status: "draft" | "published" | "archived";
    teacher_profile_id: string | null;
  }>(
    `SELECT l.id              AS lesson_id,
            l.video_id,
            l.is_free_preview,
            c.id              AS course_id,
            c.status          AS course_status,
            t.profile_id      AS teacher_profile_id
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
       JOIN courses c         ON c.id = s.course_id
       LEFT JOIN teachers t   ON t.id = c.teacher_id
      WHERE l.id = ? AND l.deleted_at IS NULL AND c.deleted_at IS NULL`,
    [lessonId]
  );

  if (!user) {
    return {
      lesson: null,
      facts: {
        authenticated: false,
        lessonExists: !!row,
        courseStatus: null,
        isFreePreview: false,
        isActivelyEnrolled: false,
        isOwningTeacher: false,
        isAdmin: false,
      },
    };
  }

  if (!row) {
    return {
      lesson: null,
      facts: {
        authenticated: true,
        lessonExists: false,
        courseStatus: null,
        isFreePreview: false,
        isActivelyEnrolled: false,
        isOwningTeacher: false,
        isAdmin,
      },
    };
  }

  const isOwningTeacher = row.teacher_profile_id === user.id;

  /*
    Asked only when it can change the answer.

    decideVideoAccess() returns early for an admin, for the owning
    teacher, and for a free preview, so the enrollment lookup would be
    ignored in those cases — and this is on the path of every video
    request. Skipping it is not a shortcut around the check: the value
    stays false, and any decision that actually depends on enrollment
    still reaches the query below.
  */
  let isActivelyEnrolled = false;
  if (!isAdmin && !isOwningTeacher && !row.is_free_preview) {
    isActivelyEnrolled = await hasActiveEnrollment(user.id, row.course_id);
  }

  return {
    lesson: {
      id: row.lesson_id,
      videoId: row.video_id,
      isFreePreview: row.is_free_preview === 1,
      courseId: row.course_id,
    },
    facts: {
      authenticated: true,
      lessonExists: true,
      courseStatus: row.course_status,
      isFreePreview: row.is_free_preview === 1,
      isActivelyEnrolled,
      isOwningTeacher,
      isAdmin,
    },
  };
}
