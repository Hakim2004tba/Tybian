"use server";

import { execute, newId, query, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { visibleDocument, libraryReady } from "@/lib/data/library";
import { parseStrokes, type InkStroke } from "@/lib/library/ink";

/**
 * Saving and loading a page's ink.
 *
 * Same access rule as every other thing a student writes here: the
 * document must be one they may read, proved through visibleDocument()
 * rather than trusted from the id in the request.
 *
 * Saving replaces the page. The client holds the authoritative list
 * while drawing and sends it after the hand stops — appending stroke by
 * stroke would mean a database write per squiggle, and a page drawn on
 * for a minute would be hundreds of them.
 */

async function reader(documentId: string): Promise<string | null> {
  const user = await requireAuth("/dashboard/lessons");
  if (!(await libraryReady())) return null;

  const profile = await queryOne<{ academic_year_id: string | null }>(
    `SELECT academic_year_id FROM profiles WHERE id = ?`,
    [user.id]
  );
  const doc = await visibleDocument(
    documentId,
    profile?.academic_year_id ?? null,
    user.role === "admin"
  );
  return doc ? user.id : null;
}

export async function saveInkAction(
  documentId: string,
  page: number,
  strokes: InkStroke[]
): Promise<{ ok: boolean }> {
  const userId = await reader(documentId);
  if (!userId) return { ok: false };

  /*
    A cap, because the column is not unlimited and a stuck pointer can
    generate strokes forever. Two thousand is far past any real page and
    still far inside MEDIUMTEXT.
  */
  const capped = strokes.slice(0, 2000);

  if (capped.length === 0) {
    await execute(
      `DELETE FROM library_ink WHERE document_id = ? AND user_id = ? AND page = ?`,
      [documentId, userId, Math.max(1, Math.round(page))]
    );
    return { ok: true };
  }

  await execute(
    `INSERT INTO library_ink (id, document_id, user_id, page, strokes)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE strokes = VALUES(strokes)`,
    [newId(), documentId, userId, Math.max(1, Math.round(page)), JSON.stringify(capped)]
  );
  return { ok: true };
}

/** Every page's ink for this document, fetched once when it opens. */
export async function loadInkAction(
  documentId: string
): Promise<Record<number, InkStroke[]>> {
  const userId = await reader(documentId);
  if (!userId) return {};

  const rows = await query<{ page: number; strokes: string }>(
    `SELECT page, strokes FROM library_ink WHERE document_id = ? AND user_id = ?`,
    [documentId, userId]
  );

  const byPage: Record<number, InkStroke[]> = {};
  for (const row of rows) byPage[Number(row.page)] = parseStrokes(row.strokes);
  return byPage;
}
