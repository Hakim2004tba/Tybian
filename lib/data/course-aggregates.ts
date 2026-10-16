import "server-only";
import { execute } from "@/lib/db";

/**
 * Recomputes a course's denormalised counters.
 *
 * Replaces the database triggers that maintained them:
 * trg_lessons_aggregates (0007) and trg_course_sections_aggregates
 * (0011). Both are gone with Postgres, and nothing warns when a
 * denormalised counter stops being maintained — the course page simply
 * shows "12 دروس" for a course with 15, and keeps doing so.
 *
 * So every write that adds, removes or re-parents a lesson, a section or
 * a video MUST call this afterwards. The places that do:
 *
 *   lib/admin/actions/sections.ts   add / delete a section
 *   lib/admin/actions/lessons.ts    add / delete a lesson, attach video
 *   lib/admin/actions/videos.ts     attach / detach a video
 *
 * Recomputing from scratch rather than incrementing: a trigger could
 * afford deltas because it saw every change, and this cannot. A full
 * recount is a few indexed rows and is self-correcting — a counter that
 * has drifted is repaired by the next write.
 *
 * 0011 existed precisely because the original trigger only fired on
 * `lessons` and missed section deletes, which left the counts wrong.
 * The soft-delete filters below are what that migration was fixing;
 * keep both `l.deleted_at IS NULL` and `s.deleted_at IS NULL`.
 */
export async function recomputeCourseAggregates(courseId: string): Promise<void> {
  await execute(
    `UPDATE courses c
        SET c.lessons_count = (
              SELECT COUNT(*)
                FROM lessons l
                JOIN course_sections s ON s.id = l.section_id
               WHERE s.course_id = c.id
                 AND l.deleted_at IS NULL AND s.deleted_at IS NULL
            ),
            c.videos_count = (
              SELECT COUNT(*)
                FROM lessons l
                JOIN course_sections s ON s.id = l.section_id
                JOIN videos v          ON v.id = l.video_id AND v.deleted_at IS NULL
               WHERE s.course_id = c.id
                 AND l.deleted_at IS NULL AND s.deleted_at IS NULL
            ),
            c.duration_minutes = (
              SELECT COALESCE(ROUND(SUM(v.duration_seconds) / 60), 0)
                FROM lessons l
                JOIN course_sections s ON s.id = l.section_id
                JOIN videos v          ON v.id = l.video_id AND v.deleted_at IS NULL
               WHERE s.course_id = c.id
                 AND l.deleted_at IS NULL AND s.deleted_at IS NULL
            )
      WHERE c.id = ?`,
    [courseId]
  );
}

/** The course a section belongs to — for callers holding only a section id. */
export async function recomputeAggregatesForSection(sectionId: string): Promise<void> {
  await execute(
    `UPDATE courses c
       JOIN course_sections s ON s.course_id = c.id
        SET c.lessons_count = (
              SELECT COUNT(*) FROM lessons l2
                JOIN course_sections s2 ON s2.id = l2.section_id
               WHERE s2.course_id = c.id AND l2.deleted_at IS NULL AND s2.deleted_at IS NULL
            ),
            c.videos_count = (
              SELECT COUNT(*) FROM lessons l2
                JOIN course_sections s2 ON s2.id = l2.section_id
                JOIN videos v2          ON v2.id = l2.video_id AND v2.deleted_at IS NULL
               WHERE s2.course_id = c.id AND l2.deleted_at IS NULL AND s2.deleted_at IS NULL
            ),
            c.duration_minutes = (
              SELECT COALESCE(ROUND(SUM(v2.duration_seconds) / 60), 0) FROM lessons l2
                JOIN course_sections s2 ON s2.id = l2.section_id
                JOIN videos v2          ON v2.id = l2.video_id AND v2.deleted_at IS NULL
               WHERE s2.course_id = c.id AND l2.deleted_at IS NULL AND s2.deleted_at IS NULL
            )
      WHERE s.id = ?`,
    [sectionId]
  );
}
