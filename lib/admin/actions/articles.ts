"use server";

import { revalidatePath } from "next/cache";
import { execute, newId } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null; redirectTo?: string };

function slugify(input: string): string {
  return input
    .trim()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .toLowerCase();
}

/** MariaDB's duplicate-key code, where Postgres said 23505. */
const isDuplicate = (error: unknown) => (error as { code?: string }).code === "ER_DUP_ENTRY";

export async function createArticleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRouteAccess("/admin");

  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;

  if (!title) return { error: "الرجاء إدخال عنوان المقال" };
  if (!body) return { error: "الرجاء كتابة محتوى المقال" };

  const slug = slugify(slugInput || title);
  if (!slug) return { error: "تعذّر توليد رابط صالح من العنوان" };

  const id = newId();

  try {
    await execute(
      `INSERT INTO articles (id, title, slug, excerpt, body, cover_url, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, slug, excerpt, body, coverUrl, user.id]
    );
  } catch (error) {
    if (isDuplicate(error)) return { error: "هذا الرابط (slug) مستخدم بالفعل" };
    return { error: "تعذّر إنشاء المقال: " + (error as Error).message };
  }

  revalidatePath("/admin/articles");

  /*
    Returned, not redirect()ed.

    A server action's own redirect comes back as a 303 with an RSC stream
    the client must parse, and on this host that response is served from
    a cache — the browser then reads a page payload where it expects an
    action result and throws. The caller navigates instead. Same reason
    as sign-in; see lib/auth/actions.ts.
  */
  return { error: null, redirectTo: `/admin/articles/${id}` };
}

export async function updateArticleAction(
  articleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;

  if (!title) return { error: "الرجاء إدخال عنوان المقال" };
  if (!body) return { error: "الرجاء كتابة محتوى المقال" };

  const slug = slugify(slugInput || title);

  try {
    await execute(
      `UPDATE articles
          SET title = ?, slug = ?, excerpt = ?, body = ?, cover_url = ?
        WHERE id = ?`,
      [title, slug, excerpt, body, coverUrl, articleId]
    );
  } catch (error) {
    if (isDuplicate(error)) return { error: "هذا الرابط (slug) مستخدم بالفعل" };
    return { error: "تعذّر حفظ التعديلات" };
  }

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  return { error: null, success: "تم الحفظ" };
}

export async function togglePublishArticleAction(articleId: string, publish: boolean) {
  await requireRouteAccess("/admin");

  try {
    await execute(
      `UPDATE articles
          SET is_published = ?, published_at = ${publish ? "UTC_TIMESTAMP(3)" : "NULL"}
        WHERE id = ?`,
      [publish ? 1 : 0, articleId]
    );
  } catch {
    return { error: "تعذّر تحديث حالة النشر" };
  }

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  return { error: null };
}

export async function deleteArticleAction(articleId: string) {
  await requireRouteAccess("/admin");

  try {
    await execute(`UPDATE articles SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [articleId]);
  } catch {
    return { error: "تعذّر حذف المقال" };
  }

  revalidatePath("/admin/articles");
  return { error: null };
}
