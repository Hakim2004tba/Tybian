"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

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

  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("lessons")
    .select("sort_order")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  // Video attachment is a separate step (Upload Video / Attach Video to
  // Lesson) — see lib/admin/actions/videos.ts — a lesson can exist
  // without a video_id and gets one attached afterward.
  const { error } = await supabase.from("lessons").insert({
    section_id: sectionId,
    title,
    sort_order: nextOrder,
    is_free_preview: isFreePreview,
  });

  if (error) return { error: "تعذّر إضافة الدرس: " + error.message };

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ title, is_free_preview: isFreePreview })
    .eq("id", lessonId);

  if (error) return { error: "تعذّر حفظ التعديلات: " + error.message };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null, success: "تم الحفظ" };
}

export async function deleteLessonAction(lessonId: string, courseId: string) {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lessons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", lessonId);

  if (error) return { error: "تعذّر حذف الدرس: " + error.message };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

/** Same up/down swap pattern as section reordering — see sections.ts. */
export async function reorderLessonAction(
  sectionId: string,
  courseId: string,
  lessonId: string,
  direction: "up" | "down"
) {
  await assertAdmin();
  const supabase = await createClient();

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, sort_order")
    .eq("section_id", sectionId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error || !lessons) return { error: "تعذّر إعادة الترتيب" };

  const index = lessons.findIndex((l) => l.id === lessonId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= lessons.length) {
    return { error: null };
  }

  const current = lessons[index];
  const target = lessons[targetIndex];

  await Promise.all([
    supabase.from("lessons").update({ sort_order: target.sort_order }).eq("id", current.id),
    supabase.from("lessons").update({ sort_order: current.sort_order }).eq("id", target.id),
  ]);

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}

export async function toggleLessonPreviewAction(
  lessonId: string,
  courseId: string,
  nextValue: boolean
) {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lessons")
    .update({ is_free_preview: nextValue })
    .eq("id", lessonId);

  if (error) return { error: "تعذّر تحديث حالة المعاينة" };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}
