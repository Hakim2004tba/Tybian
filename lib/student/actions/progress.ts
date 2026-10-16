"use server";

import { upsertProgress } from "@/lib/data/lesson-progress-write";
import { getSessionUser } from "@/lib/auth/session";

/**
 * The video player's progress heartbeat.
 *
 * Writes only the caller's own row: the user id comes from the session,
 * not from an argument. Progress tracking deliberately does not require
 * enrollment — but the player only calls this after a successful
 * /api/lessons/:id/playback response, so a row here implies the access
 * check already passed.
 *
 * The monotonic-completion and never-rewind rules that used to be
 * written out here live in the shared upsertProgress(), expressed as SQL
 * — which also fixes the race two concurrent heartbeats had when each
 * read the row before either wrote it.
 */
export async function updateLessonProgressAction(
  lessonId: string,
  positionSeconds: number,
  isCompleted: boolean
): Promise<{ error: string | null }> {
  const user = await getSessionUser();
  if (!user) return { error: "unauthenticated" };

  try {
    await upsertProgress(user.id, lessonId, positionSeconds, isCompleted);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "unknown error" };
  }
}
