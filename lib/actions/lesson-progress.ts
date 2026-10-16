"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { upsertProgress } from "@/lib/data/lesson-progress-write";

export type ProgressActionState = { error: string | null };

/**
 * Persists "last position" and "watched to completion" from the player.
 *
 * The row written is always the session's own: `user_id` comes from
 * getSessionUser(), never from an argument, so a forged call can only
 * ever affect the caller's own progress. That used to be guaranteed
 * twice — here and by lesson_progress_owner_all — and is now guaranteed
 * once, here.
 *
 * Deliberately does NOT re-run the playback authorization chain. By the
 * time this is called the player already holds a signed URL from
 * /api/lessons/:id/playback, and a progress row for a lesson nobody can
 * watch is inert: it grants nothing and is read back only by its owner.
 *
 * `courseSlug` is optional and only revalidates the sidebar ticks and
 * dashboard bars after a completion — omitted for the throttled
 * position-only saves so a 15-second tick does not invalidate caches.
 */
export async function updateLessonProgressAction(
  lessonId: string,
  positionSeconds: number,
  completed: boolean,
  courseSlug?: string
): Promise<ProgressActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  /*
    A player that mounts and unmounts without the student watching
    anything used to write a row at position 0 for every lesson merely
    opened. Those rows are indistinguishable from real progress in every
    count that follows, so nothing is recorded until there is something
    to record. Carried over from the pre-migration code, where it was
    added to fix exactly that.
  */
  const position = Math.max(0, Math.floor(positionSeconds));
  if (!completed && position === 0) return { error: null };

  try {
    await upsertProgress(user.id, lessonId, position, completed);
  } catch {
    return { error: "تعذّر حفظ تقدّم المشاهدة" };
  }

  if (completed && courseSlug) {
    revalidatePath(`/courses/${courseSlug}/learn`);
    revalidatePath("/dashboard");
  }

  return { error: null };
}

/**
 * The manual "تم إكمال الدرس" button.
 *
 * Passes 0 for the position and lets the upsert's GREATEST() keep
 * whatever was already saved — marking a lesson complete must never
 * rewind the student's resume point to the beginning.
 */
export async function markLessonCompleteAction(
  lessonId: string,
  courseSlug: string
): Promise<ProgressActionState> {
  return updateLessonProgressAction(lessonId, 0, true, courseSlug);
}
