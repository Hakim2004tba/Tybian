import "server-only";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 15;

export type AdminArticleRow = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  created_at: string;
};

export async function listArticlesAdmin(page: number) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("articles")
    .select("id, slug, title, is_published, created_at", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  return { items: (data ?? []) as AdminArticleRow[], totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getArticleForEdit(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, body, cover_url, is_published")
    .eq("id", id)
    .maybeSingle();
  return data;
}
