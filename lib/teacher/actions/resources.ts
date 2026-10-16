"use server";

import { revalidatePath } from "next/cache";
import { execute, query, queryOne } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getTeacherScope, ownsLesson } from "@/lib/data/teacher";
import { deleteLibraryFile } from "@/lib/library/storage";

/**
 * Editing a lesson's attachments — rename, remove, reorder.
 *
 * Uploading is a route (see app/api/teacher/resources/upload). These
 * three are small writes and belong as actions.
 *
 * Every one proves ownership of the LESSON THE RESOURCE BELONGS TO,
 * never of a lesson the caller named. A crafted request pairing an
 * owned lesson with a colleague's resource id is the exact case
 * `ownedResourceLesson` exists to refuse.
 */

export type ActionState = { error: string | null; success?: string | null };

async function ownedResourceLesson(resourceId: string): Promise<string | null> {
  const scope = await getTeacherScope();
  if (!scope || !resourceId) return null;

  const row = await queryOne<{ lesson_id: string }>(
    `SELECT lesson_id FROM lesson_resources WHERE id = ? AND deleted_at IS NULL`,
    [resourceId]
  );
  if (!row) return null;
  return (await ownsLesson(scope, row.lesson_id)) ? row.lesson_id : null;
}

export async function renameResourceAction(
  resourceId: string,
  title: string
): Promise<ActionState> {
  await requireRouteAccess("/teacher");
  if (!(await ownedResourceLesson(resourceId))) return { error: "غير مصرّح" };

  const clean = title.trim().slice(0, 255);
  if (!clean) return { error: "اكتب اسم المرفق" };

  await execute(`UPDATE lesson_resources SET title = ? WHERE id = ?`, [clean, resourceId]);
  revalidatePath("/teacher/resources");
  return { error: null, success: "حُفظ الاسم." };
}

/**
 * Soft-delete the row, hard-delete the bytes.
 *
 * The row is kept so a restore is one column away, but a 20 MB deck
 * nothing can reach is how a hosting quota fills with files nobody
 * remembers deleting.
 */
export async function deleteResourceAction(resourceId: string): Promise<ActionState> {
  await requireRouteAccess("/teacher");
  if (!(await ownedResourceLesson(resourceId))) return { error: "غير مصرّح" };

  const row = await queryOne<{ file_url: string }>(
    `SELECT file_url FROM lesson_resources WHERE id = ?`,
    [resourceId]
  );

  await execute(
    `UPDATE lesson_resources SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`,
    [resourceId]
  );
  if (row) await deleteLibraryFile(row.file_url);

  revalidatePath("/teacher/resources");
  return { error: null, success: "حُذف المرفق." };
}

export async function moveResourceAction(
  resourceId: string,
  direction: "up" | "down"
): Promise<ActionState> {
  await requireRouteAccess("/teacher");
  const lessonId = await ownedResourceLesson(resourceId);
  if (!lessonId) return { error: "غير مصرّح" };

  const ordered = await query<{ id: string }>(
    `SELECT id FROM lesson_resources
      WHERE lesson_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC`,
    [lessonId]
  );

  const index = ordered.findIndex((r) => r.id === resourceId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ordered.length) return { error: null };

  /*
    Renumber the lesson rather than swapping two values: rows created
    before ordering mattered all share sort_order 0, and swapping 0 for
    0 moves nothing. A lesson has a handful of attachments.
  */
  const reordered = [...ordered];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);

  for (const [i, r] of reordered.entries()) {
    await execute(`UPDATE lesson_resources SET sort_order = ? WHERE id = ?`, [i, r.id]);
  }

  revalidatePath("/teacher/resources");
  return { error: null };
}
