"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Called by the video player's progress heartbeat. Writes only the
 * caller's own row — enforced independently by
 * `lesson_progress_owner_all` RLS (0009_rls_policies.sql), so even if
 * this action were called with a forged lessonId for a lesson the
 * caller isn't enrolled in, the WRITE itself is allowed (progress
 * tracking doesn't require enrollment by design — but the caller could
 * never have gotten a playbackUrl for it without passing
 * decideVideoAccess first, since the player only calls this after a
 * successful /api/lessons/:id/playback response).
 */
export async function updateLessonProgressAction(
  lessonId: string,
  positionSeconds: number,
  isCompleted: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "unauthenticated" };

  // Once a lesson is marked complete, a later heartbeat with a lower
  // position (e.g. the student re-watches from the start) should not
  // un-complete it — so completion is monotonic: OR it with whatever
  // was already stored.
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("is_completed, completed_at")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const finalCompleted = isCompleted || existing?.is_completed === true;
  const completedAt = existing?.is_completed
    ? existing.completed_at
    : finalCompleted
      ? new Date().toISOString()
      : null;

  // lesson_progress has a plain (non-partial) unique constraint on
  // (user_id, lesson_id) — see 0004_engagement.sql — so a normal upsert
  // works cleanly here, unlike course_prices' partial-index case.
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      last_position_seconds: Math.max(0, Math.round(positionSeconds)),
      is_completed: finalCompleted,
      completed_at: completedAt,
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) return { error: error.message };
  return { error: null };
}
