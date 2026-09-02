import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { VideoAccessFacts } from "@/lib/video/access";

export type LessonForPlayback = {
  id: string;
  videoId: string | null;
  isFreePreview: boolean;
  courseId: string;
};

/**
 * Gathers every fact decideVideoAccess() needs, in one place, so the
 * Route Handler stays a thin "gather facts → decide → act" pipeline.
 *
 * Deliberately uses the caller's own authenticated (RLS-scoped) session
 * for everything here — lessons/courses are readable under RLS once a
 * course is published (or the caller is the owning teacher/admin), so
 * this function alone is enough to know WHETHER access should be
 * granted. It reads `lessons.video_id` (just a UUID reference — not
 * Bunny-identifying) but never touches the `videos` table itself: that
 * table is admin-only under RLS, and the actual bunny_video_id is only
 * ever fetched afterward, server-side, via service_role, and only once
 * this function's decision is ALLOW. See the playback Route Handler.
 */
export async function getLessonAccessFacts(lessonId: string): Promise<{
  facts: VideoAccessFacts;
  lesson: LessonForPlayback | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata?.role as string | undefined) ?? null;
  const isAdmin = role === "admin";

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      `id, video_id, is_free_preview,
       course_sections ( course_id,
         courses ( id, status, teacher_id, teachers ( profile_id ) ) )`
    )
    .eq("id", lessonId)
    .is("deleted_at", null)
    .maybeSingle();

  const courseRow = (
    lesson?.course_sections as unknown as {
      course_id: string;
      courses: { id: string; status: string; teacher_id: string; teachers: { profile_id: string } | null } | null;
    } | null
  )?.courses;

  if (!user) {
    return {
      lesson: null,
      facts: {
        authenticated: false,
        lessonExists: !!lesson,
        courseStatus: null,
        isFreePreview: false,
        isActivelyEnrolled: false,
        isOwningTeacher: false,
        isAdmin: false,
      },
    };
  }

  if (!lesson || !courseRow) {
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

  const isOwningTeacher = courseRow.teachers?.profile_id === user.id;

  // has_active_enrollment() is STABLE, not SECURITY DEFINER, so this RPC
  // runs under the caller's own RLS context — it can only ever see the
  // caller's own enrollment row (enrollments_select_own_or_admin), which
  // is exactly what we want here: we're asking "is *this* user enrolled",
  // never anyone else's. Reused via RPC so "is this enrollment currently
  // valid" logic lives in exactly one place (the DB), not duplicated in
  // application code — see 0007_functions_and_triggers.sql.
  const { data: isActivelyEnrolled } = await supabase.rpc("has_active_enrollment", {
    p_user_id: user.id,
    p_course_id: courseRow.id,
  });

  return {
    lesson: {
      id: lesson.id,
      videoId: lesson.video_id,
      isFreePreview: lesson.is_free_preview,
      courseId: courseRow.id,
    },
    facts: {
      authenticated: true,
      lessonExists: true,
      courseStatus: courseRow.status as VideoAccessFacts["courseStatus"],
      isFreePreview: lesson.is_free_preview,
      isActivelyEnrolled: Boolean(isActivelyEnrolled),
      isOwningTeacher,
      isAdmin,
    },
  };
}
