"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

function slugify(input: string): string {
  return input
    .trim()
    .replace(/[\u064B-\u0652]/g, "") // strip Arabic diacritics
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .toLowerCase();
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Every action here re-checks admin access server-side via
 * requireRouteAccess, in addition to the RLS policies that would reject
 * the write anyway — belt and suspenders per the existing three-layer
 * authorization model (middleware → layout guard → RLS). Actions are
 * only reachable from within /admin/**, but Server Actions are callable
 * URLs in their own right, so they can't rely on the page wrapper alone.
 */
async function assertAdmin() {
  await requireRouteAccess("/admin");
}

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const level = String(formData.get("level") ?? "beginner");
  const description = String(formData.get("description") ?? "").trim() || null;
  const shortDescription = String(formData.get("shortDescription") ?? "").trim() || null;
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const learningOutcomes = parseLines(String(formData.get("learningOutcomes") ?? ""));

  if (!title) return { error: "الرجاء إدخال عنوان الدورة" };
  if (!teacherId) return { error: "الرجاء اختيار الأستاذ" };
  if (!academicYearId) return { error: "الرجاء اختيار السنة الدراسية" };

  const slug = slugify(slugInput || title);
  if (!slug) return { error: "تعذّر توليد رابط صالح من العنوان، أدخل رابطاً يدوياً" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      slug,
      teacher_id: teacherId,
      academic_year_id: academicYearId,
      level,
      description,
      short_description: shortDescription,
      cover_url: coverUrl,
      tags,
      learning_outcomes: learningOutcomes,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "هذا الرابط (slug) مستخدم بالفعل، اختر رابطاً آخر" };
    return { error: "تعذّر إنشاء الدورة: " + error.message };
  }

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${data.id}`);
}

export async function updateCourseAction(
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");
  const level = String(formData.get("level") ?? "beginner");
  const description = String(formData.get("description") ?? "").trim() || null;
  const shortDescription = String(formData.get("shortDescription") ?? "").trim() || null;
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const learningOutcomes = parseLines(String(formData.get("learningOutcomes") ?? ""));

  if (!title) return { error: "الرجاء إدخال عنوان الدورة" };
  if (!teacherId) return { error: "الرجاء اختيار الأستاذ" };
  if (!academicYearId) return { error: "الرجاء اختيار السنة الدراسية" };

  const slug = slugify(slugInput || title);
  if (!slug) return { error: "تعذّر توليد رابط صالح، أدخل رابطاً يدوياً" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      title,
      slug,
      teacher_id: teacherId,
      academic_year_id: academicYearId,
      level,
      description,
      short_description: shortDescription,
      cover_url: coverUrl,
      tags,
      learning_outcomes: learningOutcomes,
    })
    .eq("id", courseId);

  if (error) {
    if (error.code === "23505") return { error: "هذا الرابط (slug) مستخدم بالفعل، اختر رابطاً آخر" };
    return { error: "تعذّر حفظ التعديلات: " + error.message };
  }

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return { error: null, success: "تم حفظ التعديلات" };
}

async function setCourseStatus(
  courseId: string,
  status: "draft" | "published" | "archived"
): Promise<ActionState> {
  await assertAdmin();
  const supabase = await createClient();

  if (status === "published") {
    const { data: course } = await supabase
      .from("courses")
      .select("lessons_count")
      .eq("id", courseId)
      .single();

    if (!course || course.lessons_count === 0) {
      return { error: "لا يمكن نشر دورة لا تحتوي على أي درس بعد" };
    }
  }

  const { error } = await supabase.from("courses").update({ status }).eq("id", courseId);
  if (error) return { error: "تعذّر تحديث حالة الدورة: " + error.message };

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return { error: null };
}

export async function publishCourseAction(courseId: string) {
  return setCourseStatus(courseId, "published");
}

export async function unpublishCourseAction(courseId: string) {
  return setCourseStatus(courseId, "draft");
}

export async function archiveCourseAction(courseId: string) {
  return setCourseStatus(courseId, "archived");
}

/**
 * Toggles whether this course appears in the homepage's "دورات مختارة
 * بعناية" section. Featuring a still-draft course is allowed here (the
 * toggle doesn't force-publish it) — getFeaturedCourses() on the public
 * side always re-filters by status='published' regardless, so a
 * featured-but-unpublished course can never actually leak onto the
 * live homepage; the admin just won't see it appear there until they
 * also publish it.
 */
export async function toggleFeaturedAction(courseId: string, featured: boolean) {
  await assertAdmin();
  const supabase = await createClient();

  const updates: { is_featured: boolean; featured_order: number | null } = {
    is_featured: featured,
    featured_order: null,
  };

  if (featured) {
    // New featured courses go to the end of the current order — the
    // admin can still drag/renumber via updateFeaturedOrderAction.
    const { data: existing } = await supabase
      .from("courses")
      .select("featured_order")
      .eq("is_featured", true)
      .order("featured_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    updates.featured_order = (existing?.featured_order ?? -1) + 1;
  }

  const { error } = await supabase.from("courses").update(updates).eq("id", courseId);
  if (error) return { error: "تعذّر تحديث حالة الإبراز" };

  revalidatePath("/admin/courses");
  revalidatePath("/");
  return { error: null };
}

/**
 * Soft-deletes the course itself — distinct from archiving (archived
 * courses still exist and could be republished; a deleted course is
 * meant to be gone). Blocked if any student currently has an active
 * (non-expired, non-revoked) enrollment — deleting a course a student
 * paid for and can still access would silently break their access with
 * no refund/notice path, so this is refused rather than allowed
 * outright. Archiving is offered as the safe alternative in that case.
 */
export async function deleteCourseAction(courseId: string) {
  await assertAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

  if (count && count > 0) {
    return {
      error: `لا يمكن حذف هذه الدورة — يملك ${count} طالب وصولاً فعّالاً إليها. استخدم "أرشفة" بدلاً من الحذف، أو ألغِ التسجيلات أولاً.`,
    };
  }

  const { error } = await supabase
    .from("courses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", courseId);

  if (error) return { error: "تعذّر حذف الدورة: " + error.message };

  revalidatePath("/admin/courses");
  return { error: null };
}
