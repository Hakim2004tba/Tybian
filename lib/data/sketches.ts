import "server-only";
import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { parseDocument, type SketchDocument } from "@/lib/sketch/model";

/**
 * Reads for the student's sketch notebook.
 *
 * The Supabase version had NO user_id filter and said so explicitly:
 * "RLS (migration 0038) already restricts every row to its author —
 * there is no user_id filter here doing security work". With the policy
 * gone that query returns every sketch on the platform to whoever asks,
 * so the filter below is not defensive tidiness, it is the access rule.
 */

export type SketchSummary = {
  id: string;
  title: string;
  contextLabel: string | null;
  updatedAt: string;
  document: SketchDocument;
};

/**
 * The whole notebook. Sketches are small (a few KB of JSON) and a
 * student has tens of them, not thousands, so the gallery loads the
 * documents themselves and renders previews client-side — no separate
 * thumbnail storage, and no second round trip to open one.
 */
export async function listSketches(limit = 60): Promise<SketchSummary[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await query<{
    id: string;
    title: string;
    context_label: string | null;
    updated_at: string;
    content: unknown;
  }>(
    `SELECT id, title, context_label, updated_at, content
       FROM sketches
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT ?`,
    [user.id, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    contextLabel: row.context_label,
    updatedAt: row.updated_at,
    // MariaDB stores JSON as LONGTEXT, so the driver may hand back the
    // raw string; parseDocument already validates whatever it is given.
    document: parseDocument(typeof row.content === "string" ? safeParse(row.content) : row.content),
  }));
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
