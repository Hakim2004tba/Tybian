"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, query, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { recomputeCourseAggregates } from "@/lib/data/course-aggregates";

export type ActionState = { error: string | null; success?: string | null };

async function assertAdmin() {
  await requireRouteAccess("/admin");
}

export async function addLessonAction(
  sectionId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const isFreePreview = formData.get("isFreePreview") === "on";

  if (!title) return { error: "الرجاء إدخال عنوان الدرس" };

  try {
    // Next sort_order computed in SQL, so two admins adding lessons at
    // once cannot both claim the same position.
    await execute(
      `INSERT INTO lessons (id, section_id, title, sort_order, is_free_preview)
       SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1, ?
         FROM lessons WHERE section_id = ?`,
      [newId(), sectionId, title, isFreePreview ? 1 : 0, sectionId]
    );
    // trg_lessons_aggregates (0007) did this; there are no triggers now.
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر إضافة الدرس: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null, success: "تمت إضافة الدرس" };
}

export async function editLessonAction(
  lessonId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const isFreePreview = formData.get("isFreePreview") === "on";

  if (!title) return { error: "الرجاء إدخال عنوان الدرس" };

  try {
    await execute(`UPDATE lessons SET title = ?, is_free_preview = ? WHERE id = ?`, [
      title,
      isFreePreview ? 1 : 0,
      lessonId,
    ]);
  } catch (error) {
    return { error: "تعذّر حفظ التعديلات: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null, success: "تم الحفظ" };
}

export async function deleteLessonAction(lessonId: string, courseId: string) {
  await assertAdmin();

  try {
    await execute(`UPDATE lessons SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [lessonId]);
    // Both the lesson count and, if it had a video, the duration change.
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر حذف الدرس: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

/** Same up/down swap as section reordering — see sections.ts. */
export async function reorderLessonAction(
  sectionId: string,
  courseId: string,
  lessonId: string,
  direction: "up" | "down"
) {
  await assertAdmin();

  try {
    const lessons = await query<{ id: string; sort_order: number }>(
      `SELECT id, sort_order FROM lessons
        WHERE section_id = ? AND deleted_at IS NULL
        ORDER BY sort_order ASC`,
      [sectionId]
    );

    const index = lessons.findIndex((l) => l.id === lessonId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= lessons.length) {
      return { error: null };
    }

    const current = lessons[index];
    const target = lessons[targetIndex];

    // One transaction: half a swap leaves two lessons sharing a
    // sort_order and the outline quietly wrong.
    await transaction(async (tx) => {
      await tx.execute(`UPDATE lessons SET sort_order = ? WHERE id = ?`, [
        target.sort_order,
        current.id,
      ]);
      await tx.execute(`UPDATE lessons SET sort_order = ? WHERE id = ?`, [
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

/**
 * Toggles the free-preview flag.
 *
 * Worth knowing what this switch does: decideVideoAccess() lets any
 * signed-in user watch a free-preview lesson on a published course
 * without enrollment. Turning it on gives that lesson's video away.
 */
export async function toggleLessonPreviewAction(
  lessonId: string,
  courseId: string,
  nextValue: boolean
) {
  await assertAdmin();

  try {
    await execute(`UPDATE lessons SET is_free_preview = ? WHERE id = ?`, [
      nextValue ? 1 : 0,
      lessonId,
    ]);
  } catch {
    return { error: "تعذّر تحديث حالة المعاينة" };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}
