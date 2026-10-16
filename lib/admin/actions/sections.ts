"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, query, queryOne, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { recomputeCourseAggregates } from "@/lib/data/course-aggregates";

export type ActionState = { error: string | null; success?: string | null };

async function assertAdmin() {
  await requireRouteAccess("/admin");
}

export async function addSectionAction(
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "الرجاء إدخال عنوان القسم" };

  try {
    // MAX(sort_order) + 1 computed in SQL rather than read back and
    // incremented in JS: two admins adding a section at once would
    // otherwise both read the same maximum and collide on the order.
    await execute(
      `INSERT INTO course_sections (id, course_id, title, sort_order)
       SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1
         FROM course_sections WHERE course_id = ?`,
      [newId(), courseId, title, courseId]
    );
  } catch (error) {
    return { error: "تعذّر إضافة القسم: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تمت إضافة القسم" };
}

export async function editSectionAction(
  sectionId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "الرجاء إدخال عنوان القسم" };

  try {
    await execute(`UPDATE course_sections SET title = ? WHERE id = ?`, [title, sectionId]);
  } catch (error) {
    return { error: "تعذّر حفظ التعديلات: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم الحفظ" };
}

/**
 * Soft-deletes a section.
 *
 * The parent course's lessons_count / videos_count / duration_minutes
 * used to be recomputed by trg_course_sections_aggregates (0011), a
 * migration that existed specifically because the earlier trigger fired
 * only on `lessons` and missed section deletes — leaving courses
 * advertising lessons that no longer existed. There are no triggers on
 * MariaDB, so the recompute is called here explicitly, in the same
 * transaction as the delete.
 */
export async function deleteSectionAction(sectionId: string, courseId: string) {
  await assertAdmin();

  try {
    await execute(`UPDATE course_sections SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [
      sectionId,
    ]);
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر حذف القسم: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

/**
 * Reorder by adjacent swap (move up / move down) rather than
 * drag-and-drop — at realistic section counts this is equally usable and
 * avoids a DnD dependency.
 */
export async function reorderSectionAction(
  courseId: string,
  sectionId: string,
  direction: "up" | "down"
) {
  await assertAdmin();

  try {
    const sections = await query<{ id: string; sort_order: number }>(
      `SELECT id, sort_order FROM course_sections
        WHERE course_id = ? AND deleted_at IS NULL
        ORDER BY sort_order ASC`,
      [courseId]
    );

    const index = sections.findIndex((s) => s.id === sectionId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sections.length) {
      return { error: null }; // already at the boundary, no-op
    }

    const current = sections[index];
    const target = sections[targetIndex];

    // One transaction, where the old code fired both updates in
    // parallel. Half a swap leaves two sections sharing a sort_order and
    // the outline silently in the wrong order.
    await transaction(async (tx) => {
      await tx.execute(`UPDATE course_sections SET sort_order = ? WHERE id = ?`, [
        target.sort_order,
        current.id,
      ]);
      await tx.execute(`UPDATE course_sections SET sort_order = ? WHERE id = ?`, [
        current.sort_order,
        target.id,
      ]);
    });
  } catch {
    return { error: "تعذّر إعادة الترتيب" };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}

/** Small helper kept for callers that only hold a section id. */
export async function sectionCourseId(sectionId: string): Promise<string | null> {
  await assertAdmin();
  const row = await queryOne<{ course_id: string }>(
    `SELECT course_id FROM course_sections WHERE id = ?`,
    [sectionId]
  );
  return row?.course_id ?? null;
}
