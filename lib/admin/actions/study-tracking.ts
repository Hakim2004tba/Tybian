"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, query, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Admin edits to the study syllabus.
 *
 * Deliberately separate from lib/actions/study-progress.ts, which is the
 * student's own marks — the split makes "students cannot modify the
 * structure" checkable by reading the imports rather than auditing
 * branches inside a shared file.
 *
 * study_subjects_admin_write and study_items_admin_write used to reject
 * these writes independently of the route guard. They are gone, so
 * `requireRouteAccess("/admin")` is the whole boundary and must stay the
 * first statement in every function here.
 */
async function assertAdmin() {
  await requireRouteAccess("/admin");
}

export async function createStudySubjectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const academicYearId = String(formData.get("academicYearId") ?? "") || null;

  if (!title) return { error: "الرجاء إدخال عنوان المادة" };

  try {
    // MAX(position) + 1 in SQL, so two admins adding a subject at the
    // same moment cannot both claim the same slot.
    await execute(
      `INSERT INTO study_subjects (id, title, description, academic_year_id, \`position\`)
       SELECT ?, ?, ?, ?, COALESCE(MAX(\`position\`), 0) + 1 FROM study_subjects`,
      [newId(), title, description, academicYearId]
    );
  } catch (error) {
    return { error: "تعذّر إنشاء المادة: " + (error as Error).message };
  }

  revalidatePath("/admin/study-tracking");
  return { error: null, success: "تمت إضافة المادة" };
}

export async function updateStudySubjectAction(
  subjectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const academicYearId = String(formData.get("academicYearId") ?? "") || null;

  if (!title) return { error: "الرجاء إدخال عنوان المادة" };

  try {
    await execute(
      `UPDATE study_subjects SET title = ?, description = ?, academic_year_id = ? WHERE id = ?`,
      [title, description, academicYearId, subjectId]
    );
  } catch (error) {
    return { error: "تعذّر حفظ التعديلات: " + (error as Error).message };
  }

  revalidatePath("/admin/study-tracking");
  revalidatePath(`/admin/study-tracking/${subjectId}`);
  return { error: null, success: "تم الحفظ" };
}

/**
 * Publishing is what makes a subject visible to students at all — see
 * visibilityFilter() in lib/data/study-tracking.ts, which requires
 * is_published for anyone who is not an admin.
 */
export async function toggleStudySubjectPublishedAction(subjectId: string, publish: boolean) {
  await assertAdmin();

  try {
    await execute(`UPDATE study_subjects SET is_published = ? WHERE id = ?`, [
      publish ? 1 : 0,
      subjectId,
    ]);
  } catch {
    return { error: "تعذّر تحديث حالة النشر" };
  }

  revalidatePath("/admin/study-tracking");
  revalidatePath("/dashboard/study");
  return { error: null };
}

export async function archiveStudySubjectAction(subjectId: string) {
  await assertAdmin();

  try {
    // Soft delete. The items beneath it keep their rows and their
    // students' marks; the subject simply stops being listed.
    await execute(`UPDATE study_subjects SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [
      subjectId,
    ]);
  } catch {
    return { error: "تعذّر أرشفة المادة" };
  }

  revalidatePath("/admin/study-tracking");
  return { error: null };
}

export async function createStudyItemAction(
  subjectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const rawMinutes = String(formData.get("estimatedMinutes") ?? "").trim();
  const estimatedMinutes = rawMinutes ? Number(rawMinutes) : null;

  if (!title) return { error: "الرجاء إدخال عنوان الدرس" };
  if (estimatedMinutes !== null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
    return { error: "المدة المقدّرة غير صالحة" };
  }

  try {
    await execute(
      `INSERT INTO study_items (id, subject_id, title, estimated_minutes, \`position\`)
       SELECT ?, ?, ?, ?, COALESCE(MAX(\`position\`), 0) + 1
         FROM study_items WHERE subject_id = ?`,
      [newId(), subjectId, title, estimatedMinutes, subjectId]
    );
  } catch (error) {
    return { error: "تعذّر إضافة الدرس: " + (error as Error).message };
  }

  revalidatePath(`/admin/study-tracking/${subjectId}`);
  return { error: null, success: "تمت إضافة الدرس" };
}

export async function updateStudyItemAction(
  itemId: string,
  subjectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const rawMinutes = String(formData.get("estimatedMinutes") ?? "").trim();
  const estimatedMinutes = rawMinutes ? Number(rawMinutes) : null;

  if (!title) return { error: "الرجاء إدخال عنوان الدرس" };
  if (estimatedMinutes !== null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
    return { error: "المدة المقدّرة غير صالحة" };
  }

  try {
    await execute(`UPDATE study_items SET title = ?, estimated_minutes = ? WHERE id = ?`, [
      title,
      estimatedMinutes,
      itemId,
    ]);
  } catch (error) {
    return { error: "تعذّر حفظ التعديلات: " + (error as Error).message };
  }

  revalidatePath(`/admin/study-tracking/${subjectId}`);
  return { error: null, success: "تم الحفظ" };
}

export async function archiveStudyItemAction(itemId: string, subjectId: string) {
  await assertAdmin();

  try {
    await execute(`UPDATE study_items SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [itemId]);
  } catch {
    return { error: "تعذّر أرشفة الدرس" };
  }

  revalidatePath(`/admin/study-tracking/${subjectId}`);
  return { error: null };
}

/** Adjacent swap, the same pattern as section and lesson reordering. */
export async function moveStudyItemAction(
  itemId: string,
  subjectId: string,
  direction: "up" | "down"
) {
  await assertAdmin();

  try {
    const items = await query<{ id: string; position: number }>(
      `SELECT id, \`position\` FROM study_items
        WHERE subject_id = ? AND deleted_at IS NULL
        ORDER BY \`position\` ASC`,
      [subjectId]
    );

    const index = items.findIndex((i) => i.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= items.length) {
      return { error: null };
    }

    const a = items[index];
    const b = items[targetIndex];

    // One transaction: the Supabase version issued the two updates in
    // sequence without one, and a failure between them left both rows
    // sharing a position, which silently scrambles the order.
    await transaction(async (tx) => {
      await tx.execute("UPDATE study_items SET `position` = ? WHERE id = ?", [b.position, a.id]);
      await tx.execute("UPDATE study_items SET `position` = ? WHERE id = ?", [a.position, b.id]);
    });
  } catch {
    return { error: "تعذّر إعادة الترتيب" };
  }

  revalidatePath(`/admin/study-tracking/${subjectId}`);
  return { error: null };
}
