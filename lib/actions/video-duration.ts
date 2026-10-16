"use server";

import { revalidatePath } from "next/cache";
import { execute, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { recomputeAggregatesForSection } from "@/lib/data/course-aggregates";

/**
 * Records a video's real duration the first time anyone plays it.
 *
 * WHY THIS EXISTS: YouTube's oEmbed endpoint — the only YouTube API this
 * project uses, because it needs no key — does not return duration. So
 * every YouTube-sourced lesson was stored with duration 0, and every
 * course therefore advertised "0 hours" on its sales page. The player
 * knows the duration once the video loads, so it reports it here.
 * (Vimeo needs none of this; its oEmbed returns duration at attach.)
 *
 * WRITE RULES, because this is a student-triggered write to shared
 * content — all of them are enforced below and none may be dropped:
 *
 *   - only fills a MISSING duration; it can never overwrite or shrink a
 *     value an admin set deliberately
 *   - bounded to a plausible range, so a broken player reporting
 *     Infinity or a negative cannot corrupt the catalogue
 *
 * The third original rule was "service-role, because students have no
 * write access to `videos` — and must not be given any". There is no
 * service-role client any more, and no table-level permission either:
 * every query in this app can write anything. So the narrowness of the
 * UPDATE below is what stands in for that. Keep its WHERE clause.
 */

/** 12 hours. Longer than any lecture; anything above is a bad reading. */
const MAX_PLAUSIBLE_SECONDS = 12 * 60 * 60;

export async function recordVideoDurationAction(lessonId: string, durationSeconds: number) {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };

  const seconds = Math.floor(durationSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_PLAUSIBLE_SECONDS) {
    return { error: null };
  }

  const lesson = await queryOne<{ video_id: string | null; section_id: string }>(
    `SELECT video_id, section_id FROM lessons WHERE id = ? AND deleted_at IS NULL`,
    [lessonId]
  );
  if (!lesson?.video_id) return { error: null };

  /*
    `duration_seconds = 0` in the WHERE clause is the "only fill a
    missing value" rule, expressed as a condition rather than a
    read-then-write. Two students starting the same video at once would
    otherwise both read 0 and both write, and the second would overwrite
    the first — harmless here, but the same shape silently overwrites an
    admin's figure if the read and the write ever drift apart.
  */
  const result = await execute(
    `UPDATE videos SET duration_seconds = ? WHERE id = ? AND duration_seconds = 0`,
    [seconds, lesson.video_id]
  );

  if (result.affectedRows === 0) return { error: null };

  /*
    The course's total minutes were maintained by a trigger on
    videos.duration_seconds (migration 0013). There are no triggers on
    MariaDB, so the recompute is called explicitly — without it the
    course would keep advertising 0 hours even after this fills the
    duration in, which is the exact bug this action exists to fix.
  */
  await recomputeAggregatesForSection(lesson.section_id);

  revalidatePath("/courses");
  return { error: null };
}
