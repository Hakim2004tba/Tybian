"use server";

import { execute, newId, queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { visibleDocument, libraryReady } from "@/lib/data/library";

/**
 * Everything a student writes while reading — highlights, the note on a
 * highlight, the document's notebook, bookmarks, and where they stopped.
 *
 * All of it is theirs: every statement below is keyed on
 * (document_id, user_id) or on an id re-checked against user_id, so one
 * student can never touch another's marks even with a guessed id.
 *
 * And every entry point first proves the DOCUMENT is one they may read,
 * through the same visibleDocument() the reader page uses. Without that
 * a student could seed annotations on a document belonging to another
 * academic year and learn its id, title and page count from the reply.
 */

export type LibraryActionResult = { ok: boolean; id?: string; error?: string };

async function readerContext(documentId: string) {
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
  return doc ? { userId: user.id } : null;
}

const COLORS = ["yellow", "green", "blue", "pink"] as const;
type Color = (typeof COLORS)[number];

export async function addHighlightAction(input: {
  documentId: string;
  page: number;
  color: string;
  rects: { x: number; y: number; w: number; h: number }[];
  quotedText: string;
}): Promise<LibraryActionResult> {
  const ctx = await readerContext(input.documentId);
  if (!ctx) return { ok: false, error: "forbidden" };

  const color: Color = (COLORS as readonly string[]).includes(input.color)
    ? (input.color as Color)
    : "yellow";

  /*
    Rectangles are clamped to the page, not merely validated. A selection
    that starts mid-page and ends past the bottom edge produces a rect
    taller than 1 — harmless in the database, but it paints a coloured
    band over the page below it when the reader draws it back.
  */
  const rects = input.rects
    .filter((r) => [r.x, r.y, r.w, r.h].every((n) => Number.isFinite(n)))
    .map((r) => ({
      x: clamp01(r.x),
      y: clamp01(r.y),
      w: clamp01(r.w),
      h: clamp01(r.h),
    }))
    .filter((r) => r.w > 0.001 && r.h > 0.001)
    .slice(0, 80);

  if (rects.length === 0) return { ok: false, error: "empty" };

  const id = newId();
  await execute(
    `INSERT INTO library_highlights (id, document_id, user_id, page, color, rects, quoted_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.documentId,
      ctx.userId,
      Math.max(1, Math.round(input.page)),
      color,
      JSON.stringify(rects),
      input.quotedText.slice(0, 2000) || null,
    ]
  );
  return { ok: true, id };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Recolours a highlight, or attaches/edits the note on it. */
export async function updateHighlightAction(input: {
  documentId: string;
  highlightId: string;
  color?: string;
  note?: string;
}): Promise<LibraryActionResult> {
  const ctx = await readerContext(input.documentId);
  if (!ctx) return { ok: false, error: "forbidden" };

  const sets: string[] = [];
  const params: (string | null)[] = [];

  if (input.color && (COLORS as readonly string[]).includes(input.color)) {
    sets.push("color = ?");
    params.push(input.color);
  }
  if (input.note !== undefined) {
    sets.push("note = ?");
    params.push(input.note.trim().slice(0, 4000) || null);
  }
  if (sets.length === 0) return { ok: true };

  params.push(input.highlightId, ctx.userId);
  // user_id in the WHERE, not just the id: the id alone is a guess away.
  await execute(
    `UPDATE library_highlights SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
  return { ok: true };
}

export async function deleteHighlightAction(
  documentId: string,
  highlightId: string
): Promise<LibraryActionResult> {
  const ctx = await readerContext(documentId);
  if (!ctx) return { ok: false, error: "forbidden" };

  await execute(
    `UPDATE library_highlights SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND user_id = ?`,
    [highlightId, ctx.userId]
  );
  return { ok: true };
}

/** The free notebook beside the document. One row per student per file. */
export async function saveNoteAction(documentId: string, body: string): Promise<LibraryActionResult> {
  const ctx = await readerContext(documentId);
  if (!ctx) return { ok: false, error: "forbidden" };

  await execute(
    `INSERT INTO library_notes (id, document_id, user_id, body)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body)`,
    [newId(), documentId, ctx.userId, body.slice(0, 200000)]
  );
  return { ok: true };
}

export async function toggleBookmarkAction(
  documentId: string,
  page: number,
  label: string | null
): Promise<LibraryActionResult & { bookmarked?: boolean }> {
  const ctx = await readerContext(documentId);
  if (!ctx) return { ok: false, error: "forbidden" };

  const p = Math.max(1, Math.round(page));
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM library_bookmarks WHERE document_id = ? AND user_id = ? AND page = ?`,
    [documentId, ctx.userId, p]
  );

  if (existing) {
    await execute(`DELETE FROM library_bookmarks WHERE id = ? AND user_id = ?`, [
      existing.id,
      ctx.userId,
    ]);
    return { ok: true, bookmarked: false };
  }

  await execute(
    `INSERT INTO library_bookmarks (id, document_id, user_id, page, label) VALUES (?, ?, ?, ?, ?)`,
    [newId(), documentId, ctx.userId, p, label?.slice(0, 255) || null]
  );
  return { ok: true, bookmarked: true };
}

/**
 * Where they stopped.
 *
 * Called as the reader scrolls, so it is deliberately the cheapest
 * statement here: one upsert, no read first. `pages_seen` keeps the
 * furthest page rather than the latest, so flicking back to page 2 does
 * not undo the record of having reached page 40.
 */
export async function saveProgressAction(documentId: string, page: number): Promise<void> {
  const ctx = await readerContext(documentId);
  if (!ctx) return;

  const p = Math.max(1, Math.round(page));
  await execute(
    `INSERT INTO library_progress (id, document_id, user_id, last_page, pages_seen, opened_count, last_opened_at)
     VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       last_page      = VALUES(last_page),
       pages_seen     = GREATEST(pages_seen, VALUES(pages_seen)),
       last_opened_at = UTC_TIMESTAMP(3)`,
    [newId(), documentId, ctx.userId, p, p]
  );
}

/** Counts one opening, separately from the scroll updates above. */
export async function markOpenedAction(documentId: string): Promise<void> {
  const ctx = await readerContext(documentId);
  if (!ctx) return;

  await execute(
    `INSERT INTO library_progress (id, document_id, user_id, opened_count, last_opened_at)
     VALUES (?, ?, ?, 1, UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       opened_count   = opened_count + 1,
       last_opened_at = UTC_TIMESTAMP(3)`,
    [newId(), documentId, ctx.userId]
  );
}

/** Written once, when the reader learns the real page count from the PDF. */
export async function reportPageCountAction(documentId: string, pageCount: number): Promise<void> {
  const ctx = await readerContext(documentId);
  if (!ctx) return;
  if (!Number.isFinite(pageCount) || pageCount < 1 || pageCount > 10000) return;

  /*
    Only when it is still unknown. The value comes from the browser, so
    it is not authoritative — but a null page count makes the library
    list say "?" forever, and the browser is the only thing in this
    stack that actually opens the PDF. Letting it fill the blank once is
    worth it; letting it overwrite is not.
  */
  await execute(
    `UPDATE library_documents SET page_count = ? WHERE id = ? AND page_count IS NULL`,
    [Math.round(pageCount), documentId]
  );
}
