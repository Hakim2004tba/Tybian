"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProgressActionState = { error: string | null };

/**
 * Called by the video player page to persist "last position" / "watched
 * to completion" — owned entirely by the student's own RLS-scoped
 * session (lesson_progress_owner_all policy, 0009_rls_policies.sql), no
 * admin/service_role involved. A student can only ever write their own
 * row here; RLS rejects any attempt to write another user's progress
 * regardless of what lessonId/userId this function is called with,
 * because the policy checks `user_id = auth.uid()` against the row
 * being written, not against a client-supplied field.
 *
 * Intentionally does NOT re-run the full playback authorization chain
 * (enrollment/expiration/etc.) — by the time this is called the player
 * already has a valid signed Bunny URL from /api/lessons/:id/playback,
 * and progress-tracking for a lesson the student can't actually watch
 * is harmless (an orphaned progress row with no access implications).
 *
 * `courseSlug` is optional and only used to revalidate the learn page's
 * sidebar (✓/▶ marks) and the dashboard's progress bars after a
 * completion — omitted for the frequent throttled position-only saves
 * to avoid unnecessary cache invalidation on every 15s tick.
 */
export async function updateLessonProgressAction(
  lessonId: string,
  positionSeconds: number,
  completed: boolean,
  courseSlug?: string
): Promise<ProgressActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      last_position_seconds: Math.max(0, Math.floor(positionSeconds)),
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) return { error: "تعذّر حفظ تقدّم المشاهدة" };

  if (completed && courseSlug) {
    revalidatePath(`/courses/${courseSlug}/learn`);
    revalidatePath("/dashboard");
  }

  return { error: null };
}

/**
 * The manual "تم إكمال الدرس" button — reads the existing saved
 * position first so marking complete never regresses a student's
 * resume point back to 0 (which the plain upsert above would do if
 * called with positionSeconds=0 directly).
 */
export async function markLessonCompleteAction(
  lessonId: string,
  courseSlug: string
): Promise<ProgressActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("last_position_seconds")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  return updateLessonProgressAction(lessonId, existing?.last_position_seconds ?? 0, true, courseSlug);
}
