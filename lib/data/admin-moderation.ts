import "server-only";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";

export type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  reporter: { full_name: string } | null;
  // Populated only for target_type === 'comment', best-effort.
  commentBody: string | null;
  commentLessonTitle: string | null;
};

/**
 * The moderation queue. Admin only — content_reports had no select policy
 * for anyone else, and this exposes both the reporter's identity and the
 * reported text.
 */
export async function getOpenReports(): Promise<ReportRow[]> {
  await requireAdmin();

  /*
    One query where there were two.

    `target_id` points into one of three tables depending on
    `target_type`, so it cannot be a foreign key and the join to comments
    has to be conditional — hence the AND on target_type inside the LEFT
    JOIN rather than in the WHERE clause, which would drop review reports
    entirely.
  */
  return query<ReportRow & { reporter_name: string | null }>(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
            p.full_name AS reporter_name,
            cm.body     AS commentBody,
            l.title     AS commentLessonTitle
       FROM content_reports r
       LEFT JOIN profiles p  ON p.id = r.reporter_id
       LEFT JOIN comments cm ON cm.id = r.target_id AND r.target_type = 'comment'
       LEFT JOIN lessons l   ON l.id = cm.lesson_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 50`
  ).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      target_type: r.target_type,
      target_id: r.target_id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      reporter: r.reporter_name ? { full_name: r.reporter_name } : null,
      commentBody: r.commentBody ?? null,
      commentLessonTitle: r.commentLessonTitle ?? null,
    }))
  );
}
