"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";

export type ActionState = { error: string | null; success?: string | null };

function slugify(input: string): string {
  return input
    .trim()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .toLowerCase();
}

export async function createArticleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .insert({ title, slug, excerpt, body, cover_url: coverUrl, author_id: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "هذا الرابط (slug) مستخدم بالفعل" };
    return { error: "تعذّر إنشاء المقال: " + error.message };
  }

  revalidatePath("/admin/articles");
  redirect(`/admin/articles/${data.id}`);
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("articles")
    .update({ title, slug, excerpt, body, cover_url: coverUrl })
    .eq("id", articleId);

  if (error) {
    if (error.code === "23505") return { error: "هذا الرابط (slug) مستخدم بالفعل" };
    return { error: "تعذّر حفظ التعديلات" };
  }

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  return { error: null, success: "تم الحفظ" };
}

export async function togglePublishArticleAction(articleId: string, publish: boolean) {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("articles")
    .update({ is_published: publish, published_at: publish ? new Date().toISOString() : null })
    .eq("id", articleId);

  if (error) return { error: "تعذّر تحديث حالة النشر" };

  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  return { error: null };
}

export async function deleteArticleAction(articleId: string) {
  await requireRouteAccess("/admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("articles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", articleId);

  if (error) return { error: "تعذّر حذف المقال" };

  revalidatePath("/admin/articles");
  return { error: null };
}
