"use server";

import { revalidatePath } from "next/cache";
import { refreshTeacherStudents } from "@/lib/data/counters";
import { execute, newId, queryOne, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null; redirectTo?: string };

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

/**
 * The denormalised haystack that course search reads.
 *
 * Postgres kept `search_text` current with a BEFORE INSERT/UPDATE
 * trigger (0025/0026). No triggers here, so it is composed on write —
 * and it has to be, in both create and update: a stale search_text means
 * a renamed course stays findable only under its old title.
 */
function buildSearchText(
  title: string,
  description: string | null,
  shortDescription: string | null,
  tags: string[]
): string {
  return [title, shortDescription, description, tags.join(" ")].filter(Boolean).join(" ");
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Every action here checks admin access server-side.
 *
 * This was described as belt and suspenders behind RLS. It is the belt
 * now: server actions are callable URLs in their own right, reachable
 * without ever loading a page under /admin, and nothing downstream will
 * reject the write.
 */
async function assertAdmin() {
  await requireRouteAccess("/admin");
}

/** MariaDB's duplicate-key code, where Postgres said 23505. */
const isDuplicate = (error: unknown) => (error as { code?: string }).code === "ER_DUP_ENTRY";

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

  const id = newId();

  try {
    // tags and learning_outcomes were text[]; they are JSON columns now,
    // so the arrays are serialised rather than passed through.
    await execute(
      `INSERT INTO courses
         (id, title, slug, teacher_id, academic_year_id, level, description,
          short_description, cover_url, tags, learning_outcomes, status, search_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        id,
        title,
        slug,
        teacherId,
        academicYearId,
        level,
        description,
        shortDescription,
        coverUrl,
        JSON.stringify(tags),
        JSON.stringify(learningOutcomes),
        buildSearchText(title, description, shortDescription, tags),
      ]
    );
  } catch (error) {
    if (isDuplicate(error)) return { error: "هذا الرابط (slug) مستخدم بالفعل، اختر رابطاً آخر" };
    return { error: "تعذّر إنشاء الدورة: " + (error as Error).message };
  }

  revalidatePath("/admin/courses");
  /*
    Returned, not redirect()ed.

    A server action's own redirect comes back as a 303 with an RSC stream
    the client must parse, and on this host that response is served from
    a cache — the browser then reads a page payload where it expects an
    action result and throws. The caller navigates instead. Same reason
    as sign-in; see lib/auth/actions.ts.
  */
  return { error: null, redirectTo: `/admin/courses/${id}` };
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

  try {
    await execute(
      `UPDATE courses
          SET title = ?, slug = ?, teacher_id = ?, academic_year_id = ?, level = ?,
              description = ?, short_description = ?, cover_url = ?,
              tags = ?, learning_outcomes = ?, search_text = ?
        WHERE id = ?`,
      [
        title,
        slug,
        teacherId,
        academicYearId,
        level,
        description,
        shortDescription,
        coverUrl,
        JSON.stringify(tags),
        JSON.stringify(learningOutcomes),
        buildSearchText(title, description, shortDescription, tags),
        courseId,
      ]
    );
  } catch (error) {
    if (isDuplicate(error)) return { error: "هذا الرابط (slug) مستخدم بالفعل، اختر رابطاً آخر" };
    return { error: "تعذّر حفظ التعديلات: " + (error as Error).message };
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

  if (status === "published") {
    /*
      Counted live rather than read from courses.lessons_count.

      That column is denormalised and, with the triggers gone, is only as
      fresh as the last call to recomputeCourseAggregates(). Publishing
      is the one moment where being wrong matters — a course published
      with no lessons is a paid product with nothing in it — so this
      asks the lessons table directly.
    */
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM lessons l
         JOIN course_sections s ON s.id = l.section_id
        WHERE s.course_id = ? AND l.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [courseId]
    );

    if (Number(row?.n ?? 0) === 0) {
      return { error: "لا يمكن نشر دورة لا تحتوي على أي درس بعد" };
    }
  }

  try {
    await execute(`UPDATE courses SET status = ? WHERE id = ?`, [status, courseId]);
  } catch (error) {
    return { error: "تعذّر تحديث حالة الدورة: " + (error as Error).message };
  }

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

  try {
    if (featured) {
      // New featured courses go to the end of the current order. MAX()
      // ignores NULLs, so an unordered featured course does not poison
      // the next value.
      const row = await queryOne<{ max_order: number | null }>(
        `SELECT MAX(featured_order) AS max_order FROM courses WHERE is_featured = 1`
      );
      const nextOrder = (row?.max_order ?? -1) + 1;

      await execute(`UPDATE courses SET is_featured = 1, featured_order = ? WHERE id = ?`, [
        nextOrder,
        courseId,
      ]);
    } else {
      await execute(
        `UPDATE courses SET is_featured = 0, featured_order = NULL WHERE id = ?`,
        [courseId]
      );
    }
  } catch {
    return { error: "تعذّر تحديث حالة الإبراز" };
  }

  revalidatePath("/admin/courses");
  revalidatePath("/");
  return { error: null };
}

/**
 * Soft-deletes the course.
 *
 * Active enrollments do NOT silently block this: the admin is told how
 * many students still have access and must confirm with `force`.
 * Deleting a course people paid for is a real decision with a refund and
 * notice consequence, so the count is surfaced rather than hidden — but
 * it is the admin's decision to make, not this function's to veto.
 *
 * With `force`, the students' enrollments are revoked in the same
 * operation. Leaving them pointing at a deleted course would show a
 * broken entry on their dashboard forever; revoking is the honest end
 * state, and it is soft too, so it can be undone.
 */
export async function deleteCourseAction(courseId: string, force = false) {
  await assertAdmin();

  try {
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM enrollments
        WHERE course_id = ?
          AND deleted_at IS NULL
          AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))`,
      [courseId]
    );
    const activeEnrollments = Number(row?.n ?? 0);

    if (activeEnrollments > 0 && !force) {
      // Not a refusal — a confirmation request. The caller re-invokes
      // with force once the admin has seen the number.
      return {
        error: null as string | null,
        requiresConfirmation: true,
        activeEnrollments,
      };
    }

    /*
      Revoke and delete together.

      The Supabase version issued the two updates separately, and a
      failure between them left every student's access revoked on a
      course that still existed — the worst of both outcomes. One
      transaction makes it all or nothing.
    */
    await transaction(async (tx) => {
      if (activeEnrollments > 0) {
        await tx.execute(
          `UPDATE enrollments SET deleted_at = UTC_TIMESTAMP(3)
            WHERE course_id = ? AND deleted_at IS NULL`,
          [courseId]
        );
      }
      await tx.execute(`UPDATE courses SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [courseId]);

      /* The course's own counter stops mattering, the teacher's total
         does not — and it has just dropped by this course's students. */
      const [owner] = (await tx.execute(
        `SELECT teacher_id FROM courses WHERE id = ?`,
        [courseId]
      )) as unknown as [{ teacher_id: string | null }[]];
      if (owner?.[0]?.teacher_id) await refreshTeacherStudents(owner[0].teacher_id, tx);
    });

    revalidatePath("/admin/courses");
    revalidatePath("/dashboard");
    return { error: null, revokedEnrollments: activeEnrollments };
  } catch (error) {
    return { error: "تعذّر حذف الدورة: " + (error as Error).message };
  }
}
