import "server-only";
import { createClient } from "@/lib/supabase/server";

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

export async function getOpenReports(): Promise<ReportRow[]> {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("content_reports")
    .select("id, target_type, target_id, reason, status, created_at, profiles ( full_name )")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!reports?.length) return [];

  const commentIds = reports.filter((r) => r.target_type === "comment").map((r) => r.target_id);

  const { data: comments } = commentIds.length
    ? await supabase.from("comments").select("id, body, lessons ( title )").in("id", commentIds)
    : { data: [] as { id: string; body: string; lessons: { title: string } | { title: string }[] | null }[] };

  const commentById = new Map((comments ?? []).map((c) => [c.id, c]));

  return reports.map((r) => {
    const reporterRaw = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const comment = r.target_type === "comment" ? commentById.get(r.target_id) : undefined;
    const lessonRaw = comment ? (Array.isArray(comment.lessons) ? comment.lessons[0] : comment.lessons) : null;

    return {
      id: r.id,
      target_type: r.target_type,
      target_id: r.target_id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      reporter: reporterRaw ?? null,
      commentBody: comment?.body ?? null,
      commentLessonTitle: lessonRaw?.title ?? null,
    };
  });
}
