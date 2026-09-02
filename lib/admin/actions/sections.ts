"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

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

  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("course_sections")
    .select("sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase
    .from("course_sections")
    .insert({ course_id: courseId, title, sort_order: nextOrder });

  if (error) return { error: "تعذّر إضافة القسم: " + error.message };

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("course_sections")
    .update({ title })
    .eq("id", sectionId);

  if (error) return { error: "تعذّر حفظ التعديلات: " + error.message };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم الحفظ" };
}

export async function deleteSectionAction(sectionId: string, courseId: string) {
  await assertAdmin();
  const supabase = await createClient();

  // Soft delete — matches the schema's deleted_at convention; lessons
  // under this section remain in the DB (soft-deletable separately if
  // needed later). The `trg_course_sections_aggregates` trigger
  // (0011_fix_section_delete_aggregates.sql) recomputes the parent
  // course's lessons_count/videos_count/duration_minutes whenever a
  // section's deleted_at changes — this was a real gap found during
  // testing (the original 0007 trigger only fired on `lessons` row
  // changes, not on the parent section), fixed at the DB level so it
  // holds regardless of which code path deletes a section.
  const { error } = await supabase
    .from("course_sections")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sectionId);

  if (error) return { error: "تعذّر حذف القسم: " + error.message };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

/**
 * Reorder via a simple adjacent swap (move up / move down) rather than
 * drag-and-drop — avoids pulling in a DnD library for what is, at
 * realistic section counts per course (a handful), an equally usable
 * interaction. See DESIGN_SYSTEM.md performance rules on avoiding
 * unnecessary heavy dependencies.
 */
export async function reorderSectionAction(
  courseId: string,
  sectionId: string,
  direction: "up" | "down"
) {
  await assertAdmin();
  const supabase = await createClient();

  const { data: sections, error } = await supabase
    .from("course_sections")
    .select("id, sort_order")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error || !sections) return { error: "تعذّر إعادة الترتيب" };

  const index = sections.findIndex((s) => s.id === sectionId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= sections.length) {
    return { error: null }; // already at the boundary, no-op
  }

  const current = sections[index];
  const target = sections[targetIndex];

  await Promise.all([
    supabase.from("course_sections").update({ sort_order: target.sort_order }).eq("id", current.id),
    supabase.from("course_sections").update({ sort_order: current.sort_order }).eq("id", target.id),
  ]);

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}
