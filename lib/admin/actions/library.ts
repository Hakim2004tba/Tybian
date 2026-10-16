"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { columnExists } from "@/lib/db/tables";
import { requireRouteAccess } from "@/lib/auth/session";
import { deleteLibraryFile } from "@/lib/library/storage";

/**
 * The admin's side of "الدروس": organising folders and managing the
 * documents uploaded into them.
 *
 * The UPLOAD itself is not here — it is a route handler
 * (app/api/admin/library/upload), because a server action receives the
 * whole request body in memory before it runs, and a 40 MB lecture PDF
 * through an action is 40 MB held per concurrent upload on a shared
 * host. The route streams it instead and writes one row when it lands.
 */

export type ActionState = { error: string | null; success?: string | null };

export async function createFolderAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  if (!title) return { error: "اكتب اسم المجلّد" };

  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const rawYear = String(formData.get("academicYearId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  /*
    The year belongs to ROOT folders only, and is forced to null on a
    sub-folder rather than merely ignored. A sub-folder carrying a
    different year than its parent would be invisible to everyone: the
    student check reads the year from the root, so the child's own
    value could only ever contradict it.
  */
  const academicYearId = parentId ? null : rawYear || null;

  if (parentId) {
    const parent = await queryOne<{ id: string }>(
      `SELECT id FROM library_folders WHERE id = ? AND deleted_at IS NULL`,
      [parentId]
    );
    if (!parent) return { error: "المجلّد الأب غير موجود" };
  }

  const positionRow = await queryOne<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM library_folders
      WHERE deleted_at IS NULL AND ${parentId ? "parent_id = ?" : "parent_id IS NULL"}`,
    parentId ? [parentId] : []
  );

  await execute(
    `INSERT INTO library_folders (id, academic_year_id, parent_id, title, description, sort_order, is_published)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [newId(), academicYearId, parentId, title, description, Number(positionRow?.n ?? 0)]
  );

  revalidatePath("/admin/library");
  return { error: null, success: "أُنشئ المجلّد." };
}

export async function updateFolderAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  if (!id || !title) return { error: "اكتب اسم المجلّد" };

  const description = String(formData.get("description") ?? "").trim() || null;
  const rawYear = String(formData.get("academicYearId") ?? "").trim();

  const folder = await queryOne<{ parent_id: string | null }>(
    `SELECT parent_id FROM library_folders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (!folder) return { error: "المجلّد غير موجود" };

  // Same rule as on create: only a root folder carries a year.
  const academicYearId = folder.parent_id ? null : rawYear || null;

  await execute(
    `UPDATE library_folders SET title = ?, description = ?, academic_year_id = ? WHERE id = ?`,
    [title, description, academicYearId, id]
  );

  revalidatePath("/admin/library");
  return { error: null, success: "حُدِّث المجلّد." };
}

export async function toggleFolderPublishedAction(id: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  await execute(
    `UPDATE library_folders SET is_published = 1 - is_published WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  revalidatePath("/admin/library");
  return { error: null };
}

/**
 * Soft delete, and it cascades in the UI sense only.
 *
 * The row is marked rather than removed, so an accidental delete of a
 * whole module is recoverable in phpMyAdmin by clearing one column.
 * Children keep their own deleted_at untouched — but they become
 * unreachable, because every student read walks the chain up to the
 * root and stops at the first deleted ancestor.
 */
export async function deleteFolderAction(id: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  await execute(`UPDATE library_folders SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [id]);
  revalidatePath("/admin/library");
  return { error: null, success: "حُذف المجلّد." };
}

export async function updateDocumentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  if (!id || !title) return { error: "اكتب عنوان الملفّ" };

  const description = String(formData.get("description") ?? "").trim() || null;

  await execute(`UPDATE library_documents SET title = ?, description = ? WHERE id = ?`, [
    title,
    description,
    id,
  ]);

  /*
    THE COURSE THIS LESSON BELONGS TO.

    Written separately and only when the column is there, so an admin
    saving a title on a server that has not run migration 15 gets the
    title saved rather than an error about an unknown column. The empty
    value means "no course", not "leave it alone" — the select always
    submits, so clearing it must clear the link.
  */
  if (await columnExists("library_documents", "course_id")) {
    const courseId = String(formData.get("courseId") ?? "").trim() || null;
    await execute(`UPDATE library_documents SET course_id = ? WHERE id = ?`, [courseId, id]);
  }

  revalidatePath("/admin/library");
  return { error: null, success: "حُدِّث الملفّ." };
}

export async function toggleDocumentPublishedAction(id: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  await execute(
    `UPDATE library_documents SET is_published = 1 - is_published WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  revalidatePath("/admin/library");
  return { error: null };
}

/**
 * Removes a document AND its file.
 *
 * The row is soft-deleted, so a student's highlights on it survive and
 * come back if it is restored — but the bytes are removed from disk for
 * real. Keeping a 40 MB file that nothing can reach is how a 150 GB
 * shared-hosting quota fills up with documents nobody remembers
 * deleting.
 */
export async function deleteDocumentAction(id: string): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const row = await queryOne<{ file_path: string }>(
    `SELECT file_path FROM library_documents WHERE id = ?`,
    [id]
  );

  await execute(`UPDATE library_documents SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [id]);
  if (row) await deleteLibraryFile(row.file_path);

  revalidatePath("/admin/library");
  return { error: null, success: "حُذف الملفّ." };
}

/** Moves a document one place within its folder. */
export async function moveDocumentAction(id: string, direction: "up" | "down"): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const doc = await queryOne<{ folder_id: string }>(
    `SELECT folder_id FROM library_documents WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (!doc) return { error: null };

  const { query } = await import("@/lib/db");
  const ordered = await query<{ id: string }>(
    `SELECT id FROM library_documents
      WHERE folder_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, title ASC`,
    [doc.folder_id]
  );

  const index = ordered.findIndex((d) => d.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ordered.length) return { error: null };

  /*
    Renumber the folder rather than swapping two values: rows created
    before ordering mattered all share sort_order 0, and swapping 0 for
    0 moves nothing. The list is one folder long.
  */
  const reordered = [...ordered];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);

  for (const [i, d] of reordered.entries()) {
    await execute(`UPDATE library_documents SET sort_order = ? WHERE id = ?`, [i, d.id]);
  }

  revalidatePath("/admin/library");
  return { error: null };
}
