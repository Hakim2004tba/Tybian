import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  author: { full_name: string } | null;
};

const PAGE_SIZE = 9;

export async function getPublishedArticles(page: number) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, cover_url, published_at, profiles ( full_name )", { count: "exact" })
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .range(from, to);

  const items: ArticleListItem[] = (data ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    cover_url: a.cover_url,
    published_at: a.published_at,
    author: Array.isArray(a.profiles) ? (a.profiles[0] ?? null) : a.profiles,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

export type ArticleDetail = ArticleListItem & { body: string };

export async function getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, body, cover_url, published_at, profiles ( full_name )")
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    author: Array.isArray(data.profiles) ? (data.profiles[0] ?? null) : data.profiles,
  };
}
