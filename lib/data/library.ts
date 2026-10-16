import "server-only";
import { query, queryOne } from "@/lib/db";
import { tablesExist, columnExists } from "@/lib/db/tables";
import type { DocumentKind } from "@/lib/library/storage";

/**
 * "الدروس" — the university's own course documents, read inside the
 * platform.
 *
 * Reads only. Every write goes through lib/library/actions.ts (the
 * student's own annotations) or lib/admin/actions/library.ts (the
 * admin's organising and uploading).
 *
 * VISIBILITY, which is the whole security model of this feature:
 * a document is readable by a student when it is published, its folder
 * chain is published, and that chain is scoped either to the student's
 * own academic year or to no year at all (a document for everyone).
 * `visibleDocument()` below is the single place that decides it, and
 * both the page and the file route call it — a file served without
 * asking it is a paid document handed to anyone with the link.
 */

export const LIBRARY_TABLES = [
  "library_folders",
  "library_documents",
  "library_highlights",
  "library_notes",
  "library_bookmarks",
  "library_progress",
];

export async function libraryReady(): Promise<boolean> {
  return tablesExist(LIBRARY_TABLES);
}

export type LibraryFolder = {
  id: string;
  parentId: string | null;
  academicYearId: string | null;
  title: string;
  description: string | null;
  isPublished: boolean;
  sortOrder: number;
  documentCount: number;
  childCount: number;
};

export type LibraryDocument = {
  id: string;
  folderId: string;
  title: string;
  description: string | null;
  kind: DocumentKind;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  pageCount: number | null;
  isPublished: boolean;
  sortOrder: number;
  /** The course whose videos explain it. Null until migration 15. */
  courseId: string | null;
};

type FolderRow = {
  id: string;
  parent_id: string | null;
  academic_year_id: string | null;
  title: string;
  description: string | null;
  is_published: number;
  sort_order: number;
  document_count: number;
  child_count: number;
};

type DocumentRow = {
  id: string;
  folder_id: string;
  title: string;
  description: string | null;
  kind: DocumentKind;
  mime_type: string;
  original_name: string;
  size_bytes: number;
  page_count: number | null;
  is_published: number;
  sort_order: number;
};

const toFolder = (r: FolderRow): LibraryFolder => ({
  id: r.id,
  parentId: r.parent_id,
  academicYearId: r.academic_year_id,
  title: r.title,
  description: r.description,
  isPublished: r.is_published === 1,
  sortOrder: r.sort_order,
  documentCount: Number(r.document_count ?? 0),
  childCount: Number(r.child_count ?? 0),
});

const toDocument = (r: DocumentRow): LibraryDocument => ({
  id: r.id,
  folderId: r.folder_id,
  title: r.title,
  description: r.description,
  kind: r.kind,
  mimeType: r.mime_type,
  originalName: r.original_name,
  sizeBytes: Number(r.size_bytes ?? 0),
  pageCount: r.page_count === null ? null : Number(r.page_count),
  isPublished: r.is_published === 1,
  sortOrder: r.sort_order,
  courseId: (r as { course_id?: string | null }).course_id ?? null,
});

/*
  The column lists are written out in every query rather than shared
  through a constant.

  A constant reads better and was the first thing I did — but it also
  hides the columns from tests/sql-columns.test.mjs, which resolves an
  alias like `d.` from the FROM clause of the SAME template literal. A
  detached list has no FROM, so every column in it was silently
  unchecked, which is how `s.position` and `lp.completed` reached
  production twice before. Repetition here buys a test that actually
  runs on this code.

  The counts are subqueries rather than joins with GROUP BY: a folder
  with no documents and no children must still appear, and two LEFT
  JOINs aggregated together multiply each other's rows.
*/

/* ------------------------------------------------------------------ */
/*  Student side                                                       */
/* ------------------------------------------------------------------ */

/**
 * Folders a student may open, at one level of the tree.
 *
 * `parentId === null` asks for the roots. The year filter applies to
 * roots only: nesting inherits the root's audience, and repeating the
 * comparison on children would hide a sub-folder whose own year column
 * was left null — which is every sub-folder, since the admin sets the
 * year once at the top.
 */
export async function listFoldersForStudent(
  academicYearId: string | null,
  parentId: string | null
): Promise<LibraryFolder[]> {
  if (!(await libraryReady())) return [];

  const params: (string | null)[] = [];
  let where = `f.deleted_at IS NULL AND f.is_published = 1`;

  if (parentId === null) {
    where += ` AND f.parent_id IS NULL AND (f.academic_year_id IS NULL`;
    if (academicYearId) {
      where += ` OR f.academic_year_id = ?`;
      params.push(academicYearId);
    }
    where += `)`;
  } else {
    where += ` AND f.parent_id = ?`;
    params.push(parentId);
  }

  const rows = await query<FolderRow>(
    `SELECT f.id, f.parent_id, f.academic_year_id, f.title, f.description,
              f.is_published, f.sort_order,
              (SELECT COUNT(*) FROM library_documents d
                 WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS document_count,
              (SELECT COUNT(*) FROM library_folders c
                 WHERE c.parent_id = f.id AND c.deleted_at IS NULL) AS child_count FROM library_folders f
      WHERE ${where}
      ORDER BY f.sort_order ASC, f.title ASC`,
    params
  );
  return rows.map(toFolder);
}

export async function listDocumentsForStudent(folderId: string): Promise<LibraryDocument[]> {
  if (!(await libraryReady())) return [];
  const rows = await query<DocumentRow>(
    `SELECT d.id, d.folder_id, d.title, d.description, d.kind, d.mime_type,
              d.original_name, d.size_bytes, d.page_count, d.is_published, d.sort_order FROM library_documents d
      WHERE d.folder_id = ? AND d.deleted_at IS NULL AND d.is_published = 1
      ORDER BY d.sort_order ASC, d.title ASC`,
    [folderId]
  );
  return rows.map(toDocument);
}

/**
 * The chain from a folder up to its root, for the breadcrumb.
 *
 * ONE recursive query, not one per level. The loop this replaces made a
 * round trip per ancestor — four for "Semester 1 / Anatomy / Ostéologie
 * / Introduction" — on every library page view and every document open.
 * MariaDB 10.11 has WITH RECURSIVE, so the walk belongs in the
 * database, where it is one trip regardless of depth.
 *
 * The depth cap survives the rewrite and still matters: a parent_id
 * cycle entered by hand in phpMyAdmin would otherwise recurse until the
 * server's own limit stopped it, which is a much less friendly way to
 * find out.
 */
export async function folderPath(folderId: string): Promise<{ id: string; title: string }[]> {
  if (!(await libraryReady())) return [];

  const rows = await query<{ id: string; title: string; depth: number }>(
    `WITH RECURSIVE chain AS (
       SELECT id, title, parent_id, 0 AS depth
         FROM library_folders
        WHERE id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT f.id, f.title, f.parent_id, c.depth + 1
         FROM library_folders f
         JOIN chain c ON f.id = c.parent_id
        WHERE f.deleted_at IS NULL AND c.depth < 12
     )
     SELECT id, title, depth FROM chain ORDER BY depth DESC`,
    [folderId]
  );

  return rows.map((r) => ({ id: r.id, title: r.title }));
}

export type VisibleDocument = LibraryDocument & { filePath: string; folderTitle: string };

/**
 * THE authorisation check for a single document.
 *
 * Walks up the folder chain: every ancestor must be published and not
 * deleted, and the root must be either year-less or the student's own
 * year. Checking only the document's immediate folder would let an
 * unpublished module be read through a published sub-folder inside it.
 *
 * Admins bypass the year rule, not the existence one — they need to
 * preview what they just uploaded.
 */
export async function visibleDocument(
  documentId: string,
  academicYearId: string | null,
  isAdmin = false
): Promise<VisibleDocument | null> {
  if (!(await libraryReady())) return null;

  const row = await queryOne<DocumentRow & { file_path: string; folder_title: string }>(
    `SELECT d.id, d.folder_id, d.title, d.description, d.kind, d.mime_type,
              d.original_name, d.size_bytes, d.page_count, d.is_published, d.sort_order, d.file_path, f.title AS folder_title
       FROM library_documents d
       JOIN library_folders f ON f.id = d.folder_id
      WHERE d.id = ? AND d.deleted_at IS NULL`,
    [documentId]
  );
  if (!row) return null;
  if (!isAdmin && row.is_published !== 1) return null;

  /*
    The whole ancestor chain in ONE query, same shape as folderPath().

    This runs on every document page AND on every byte range the PDF
    reader requests through /api/library/<id>/file — a reader scrolling
    a large document issues many of those. A query per folder level per
    range request is the single easiest way to make this feature the
    slowest thing on the site.
  */
  const chain = await query<{
    id: string;
    parent_id: string | null;
    academic_year_id: string | null;
    is_published: number;
    depth: number;
  }>(
    `WITH RECURSIVE chain AS (
       SELECT id, parent_id, academic_year_id, is_published, 0 AS depth
         FROM library_folders
        WHERE id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT f.id, f.parent_id, f.academic_year_id, f.is_published, c.depth + 1
         FROM library_folders f
         JOIN chain c ON f.id = c.parent_id
        WHERE f.deleted_at IS NULL AND c.depth < 12
     )
     SELECT id, parent_id, academic_year_id, is_published, depth FROM chain ORDER BY depth ASC`,
    [row.folder_id]
  );

  // A broken chain (a deleted ancestor) yields no root, which is a "no".
  if (chain.length === 0) return null;
  if (!isAdmin && chain.some((f) => f.is_published !== 1)) return null;

  const root = chain[chain.length - 1];
  if (root.parent_id !== null) return null; // chain truncated by the depth cap

  if (!isAdmin) {
    const forEveryone = root.academic_year_id === null;
    const mine = academicYearId !== null && root.academic_year_id === academicYearId;
    if (!forEveryone && !mine) return null;
  }

  return { ...toDocument(row), filePath: row.file_path, folderTitle: row.folder_title };
}

/* ------------------------------------------------------------------ */
/*  The course a lesson belongs to                                     */
/* ------------------------------------------------------------------ */

export type LinkedCourse = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  teacherName: string | null;
  lessonsCount: number;
  durationMinutes: number;
};

/**
 * The course whose videos explain this document, if a teacher or admin
 * linked one.
 *
 * Asked as a separate query rather than joined into visibleDocument
 * because `course_id` arrives in migration 15: on a server that has not
 * run it yet the column does not exist, and naming it in the main
 * SELECT would take the whole reader down instead of hiding one card.
 */
export async function linkedCourse(documentId: string): Promise<LinkedCourse | null> {
  if (!(await libraryReady())) return null;
  if (!(await columnExists("library_documents", "course_id"))) return null;

  const row = await queryOne<{
    id: string;
    slug: string;
    title: string;
    cover_url: string | null;
    teacher_name: string | null;
    lessons_count: number;
    duration_minutes: number;
  }>(
    `SELECT c.id, c.slug, c.title, c.cover_url,
            p.full_name AS teacher_name,
            c.lessons_count, c.duration_minutes
       FROM library_documents d
       JOIN courses c ON c.id = d.course_id
  LEFT JOIN teachers t ON t.id = c.teacher_id
  LEFT JOIN profiles p ON p.id = t.profile_id
      WHERE d.id = ? AND d.deleted_at IS NULL AND c.status = 'published'`,
    [documentId]
  );
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverUrl: row.cover_url,
    teacherName: row.teacher_name,
    lessonsCount: Number(row.lessons_count ?? 0),
    durationMinutes: Number(row.duration_minutes ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/*  The student's own marks                                            */
/* ------------------------------------------------------------------ */

export type Highlight = {
  id: string;
  page: number;
  color: "yellow" | "green" | "blue" | "pink";
  rects: { x: number; y: number; w: number; h: number }[];
  quotedText: string | null;
  note: string | null;
};

export async function listHighlights(documentId: string, userId: string): Promise<Highlight[]> {
  if (!(await libraryReady())) return [];
  const rows = await query<{
    id: string;
    page: number;
    color: Highlight["color"];
    rects: unknown;
    quoted_text: string | null;
    note: string | null;
  }>(
    `SELECT id, page, color, rects, quoted_text, note
       FROM library_highlights
      WHERE document_id = ? AND user_id = ? AND deleted_at IS NULL
      ORDER BY page ASC, created_at ASC`,
    [documentId, userId]
  );

  return rows.map((r) => ({
    id: r.id,
    page: Number(r.page),
    color: r.color,
    /*
      mysql2 hands a JSON column back already parsed on some versions and
      as a string on others, depending on how the column was declared and
      which driver path ran. Accepting both is cheaper than depending on
      which one this host gives us.
    */
    rects: normaliseRects(r.rects),
    quotedText: r.quoted_text,
    note: r.note,
  }));
}

function normaliseRects(value: unknown): Highlight["rects"] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (r): r is { x: number; y: number; w: number; h: number } =>
        !!r &&
        typeof r === "object" &&
        ["x", "y", "w", "h"].every((k) => typeof (r as Record<string, unknown>)[k] === "number")
    )
    .map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
}

export async function getNote(documentId: string, userId: string): Promise<string> {
  if (!(await libraryReady())) return "";
  const row = await queryOne<{ body: string | null }>(
    `SELECT body FROM library_notes WHERE document_id = ? AND user_id = ?`,
    [documentId, userId]
  );
  return row?.body ?? "";
}

export async function listBookmarks(
  documentId: string,
  userId: string
): Promise<{ id: string; page: number; label: string | null }[]> {
  if (!(await libraryReady())) return [];
  return query(
    `SELECT id, page, label FROM library_bookmarks
      WHERE document_id = ? AND user_id = ? ORDER BY page ASC`,
    [documentId, userId]
  );
}

export async function getProgress(documentId: string, userId: string): Promise<number> {
  if (!(await libraryReady())) return 1;
  const row = await queryOne<{ last_page: number }>(
    `SELECT last_page FROM library_progress WHERE document_id = ? AND user_id = ?`,
    [documentId, userId]
  );
  return Math.max(1, Number(row?.last_page ?? 1));
}

/** The "continue reading" strip on the library index. */
export async function recentDocuments(
  userId: string,
  limit = 4
): Promise<{ id: string; title: string; folderTitle: string; lastPage: number; pageCount: number | null }[]> {
  if (!(await libraryReady())) return [];
  return query(
    `SELECT d.id, d.title, f.title AS folderTitle, p.last_page AS lastPage, d.page_count AS pageCount
       FROM library_progress p
       JOIN library_documents d ON d.id = p.document_id AND d.deleted_at IS NULL AND d.is_published = 1
       JOIN library_folders  f ON f.id = d.folder_id    AND f.deleted_at IS NULL
      WHERE p.user_id = ? AND p.last_opened_at IS NOT NULL
      ORDER BY p.last_opened_at DESC
      LIMIT ${Number(limit)}`,
    [userId]
  );
}

/* ------------------------------------------------------------------ */
/*  Admin side — no publish filter, no year filter                     */
/* ------------------------------------------------------------------ */

export async function listFoldersForAdmin(parentId: string | null): Promise<LibraryFolder[]> {
  if (!(await libraryReady())) return [];
  const rows = await query<FolderRow>(
    `SELECT f.id, f.parent_id, f.academic_year_id, f.title, f.description,
              f.is_published, f.sort_order,
              (SELECT COUNT(*) FROM library_documents d
                 WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS document_count,
              (SELECT COUNT(*) FROM library_folders c
                 WHERE c.parent_id = f.id AND c.deleted_at IS NULL) AS child_count FROM library_folders f
      WHERE f.deleted_at IS NULL
        AND ${parentId === null ? "f.parent_id IS NULL" : "f.parent_id = ?"}
      ORDER BY f.sort_order ASC, f.title ASC`,
    parentId === null ? [] : [parentId]
  );
  return rows.map(toFolder);
}

export async function listDocumentsForAdmin(folderId: string): Promise<LibraryDocument[]> {
  if (!(await libraryReady())) return [];
  /* Named only when it exists — see linkedCourse() for why. */
  const courseColumn = (await columnExists("library_documents", "course_id")) ? ", d.course_id" : "";
  const rows = await query<DocumentRow>(
    `SELECT d.id, d.folder_id, d.title, d.description, d.kind, d.mime_type,
              d.original_name, d.size_bytes, d.page_count, d.is_published, d.sort_order${courseColumn} FROM library_documents d
      WHERE d.folder_id = ? AND d.deleted_at IS NULL
      ORDER BY d.sort_order ASC, d.title ASC`,
    [folderId]
  );
  return rows.map(toDocument);
}

export async function getFolder(folderId: string): Promise<LibraryFolder | null> {
  if (!(await libraryReady())) return null;
  const row = await queryOne<FolderRow>(
    `SELECT f.id, f.parent_id, f.academic_year_id, f.title, f.description,
              f.is_published, f.sort_order,
              (SELECT COUNT(*) FROM library_documents d
                 WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS document_count,
              (SELECT COUNT(*) FROM library_folders c
                 WHERE c.parent_id = f.id AND c.deleted_at IS NULL) AS child_count FROM library_folders f WHERE f.id = ? AND f.deleted_at IS NULL`,
    [folderId]
  );
  return row ? toFolder(row) : null;
}

/* ------------------------------------------------------------------ */
/*  Authorisation memo for byte-range reads                            */
/* ------------------------------------------------------------------ */

/**
 * A short-lived memo of "this session may read this document".
 *
 * THE NUMBERS THAT JUSTIFY IT. PDF.js fetches a large document in
 * ranges — a 40 MB lecture read end to end is on the order of a
 * hundred requests to /api/library/<id>/file. Each one re-ran the
 * session lookup, the profile lookup and the recursive folder walk:
 * three queries per range, several hundred per document read, and that
 * is per student. Fifty students reading during a revision week is
 * tens of thousands of queries to answer the same question about the
 * same document.
 *
 * THE COST. A document unpublished, deleted, or moved to another year
 * stays readable to a session that already opened it for up to TTL_MS.
 * Thirty seconds, for material the admin published deliberately and
 * the student is in the middle of reading. Revoking access to a PDF is
 * not an emergency operation, and the student could have kept the
 * bytes anyway. Nothing else in the app is memoised across requests.
 *
 * Keyed by session id, never by user id: signing out must not leave a
 * usable entry behind for the next session on the same account.
 */
const AUTH_TTL_MS = 30_000;
const AUTH_MAX = 2000;

type AuthEntry = { doc: VisibleDocument; expiresAt: number };
const authMemo = new Map<string, AuthEntry>();

export function rememberDocumentAccess(
  sessionId: string,
  documentId: string,
  doc: VisibleDocument
): void {
  if (authMemo.size > AUTH_MAX) {
    // Cheapest possible bound: drop the whole table rather than track
    // an eviction order. At this size it refills in seconds.
    authMemo.clear();
  }
  authMemo.set(`${sessionId}:${documentId}`, { doc, expiresAt: Date.now() + AUTH_TTL_MS });
}

export function recallDocumentAccess(
  sessionId: string,
  documentId: string
): VisibleDocument | null {
  const key = `${sessionId}:${documentId}`;
  const hit = authMemo.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    authMemo.delete(key);
    return null;
  }
  return hit.doc;
}

/* ------------------------------------------------------------------ */
/*  Finding and resuming — what makes the library usable for study     */
/* ------------------------------------------------------------------ */

export type StudentDocument = LibraryDocument & {
  folderTitle: string;
  /** Where this student stopped, and how far that is. */
  lastPage: number | null;
  highlightCount: number;
};

/*
  The student's own progress and marks, attached to the document rows in
  the SAME query.

  Fetching them per row would be two extra round trips per document on a
  folder that can hold thirty — the shape of N+1 that only shows up once
  the library is actually full. The subqueries are keyed on the
  (document_id, user_id) indexes both tables already carry.
*/
const STUDENT_DOC_EXTRAS = `
  (SELECT pr.last_page FROM library_progress pr
    WHERE pr.document_id = d.id AND pr.user_id = ?) AS last_page,
  (SELECT COUNT(*) FROM library_highlights h
    WHERE h.document_id = d.id AND h.user_id = ? AND h.deleted_at IS NULL) AS highlight_count`;

function toStudentDocument(
  r: DocumentRow & { folder_title: string; last_page: number | null; highlight_count: number }
): StudentDocument {
  return {
    ...toDocument(r),
    folderTitle: r.folder_title,
    lastPage: r.last_page === null ? null : Number(r.last_page),
    highlightCount: Number(r.highlight_count ?? 0),
  };
}

/** Documents in one folder, with this student's progress on each. */
export async function listDocumentsWithProgress(
  folderId: string,
  userId: string
): Promise<StudentDocument[]> {
  if (!(await libraryReady())) return [];

  const rows = await query<
    DocumentRow & { folder_title: string; last_page: number | null; highlight_count: number }
  >(
    `SELECT d.id, d.folder_id, d.title, d.description, d.kind, d.mime_type,
            d.original_name, d.size_bytes, d.page_count, d.is_published, d.sort_order,
            f.title AS folder_title,
            ${STUDENT_DOC_EXTRAS}
       FROM library_documents d
       JOIN library_folders f ON f.id = d.folder_id
      WHERE d.folder_id = ? AND d.deleted_at IS NULL AND d.is_published = 1
      ORDER BY d.sort_order ASC, d.title ASC`,
    [userId, userId, folderId]
  );
  return rows.map(toStudentDocument);
}

/**
 * Search every document the student may read, by title.
 *
 * A folder tree is how material is ORGANISED; it is not how a student
 * looks for it. Someone revising ostéologie types the word — they do
 * not remember which semester folder it was filed under. Without this,
 * finding one handout meant opening folders until it appeared.
 *
 * The year rule is the same one listFoldersForStudent applies, expressed
 * against the ROOT of each document's chain: a recursive walk up, then a
 * check that the root is the student's year or year-less. Written once
 * here so search cannot become a way around the visibility rules.
 */
export async function searchDocumentsForStudent(
  academicYearId: string | null,
  userId: string,
  term: string,
  limit = 40
): Promise<StudentDocument[]> {
  if (!(await libraryReady())) return [];

  const needle = term.trim();
  if (needle.length < 2) return [];

  const rows = await query<
    DocumentRow & { folder_title: string; last_page: number | null; highlight_count: number }
  >(
    `WITH RECURSIVE chain AS (
       SELECT id AS folder_id, id AS node, parent_id, academic_year_id, is_published
         FROM library_folders WHERE deleted_at IS NULL
       UNION ALL
       SELECT c.folder_id, f.id, f.parent_id, f.academic_year_id, f.is_published
         FROM library_folders f
         JOIN chain c ON f.id = c.parent_id
        WHERE f.deleted_at IS NULL
     ),
     visible AS (
       SELECT folder_id
         FROM chain
        GROUP BY folder_id
       HAVING MIN(is_published) = 1
          AND MAX(CASE WHEN parent_id IS NULL
                       AND (academic_year_id IS NULL OR academic_year_id <=> ?)
                       THEN 1 ELSE 0 END) = 1
     )
     SELECT d.id, d.folder_id, d.title, d.description, d.kind, d.mime_type,
            d.original_name, d.size_bytes, d.page_count, d.is_published, d.sort_order,
            f.title AS folder_title,
            ${STUDENT_DOC_EXTRAS}
       FROM library_documents d
       JOIN library_folders f ON f.id = d.folder_id
       JOIN visible v ON v.folder_id = d.folder_id
      WHERE d.deleted_at IS NULL AND d.is_published = 1
        AND d.title LIKE CONCAT('%', ?, '%')
      ORDER BY d.title ASC
      LIMIT ${Number(limit)}`,
    [academicYearId, userId, userId, needle]
  );

  return rows.map(toStudentDocument);
}
