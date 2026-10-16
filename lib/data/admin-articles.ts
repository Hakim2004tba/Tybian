import "server-only";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";

const PAGE_SIZE = 15;

export type AdminArticleRow = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  created_at: string;
};

export async function listArticlesAdmin(page: number) {
  await requireAdmin();

  const offset = (page - 1) * PAGE_SIZE;

  const [rows, total] = await Promise.all([
    query<Omit<AdminArticleRow, "is_published"> & { is_published: number }>(
      `SELECT id, slug, title, is_published, created_at
         FROM articles
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [PAGE_SIZE, offset]
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM articles WHERE deleted_at IS NULL`),
  ]);

  return {
    items: rows.map((r) => ({ ...r, is_published: r.is_published === 1 })),
    totalCount: Number(total?.n ?? 0),
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Admin only, and unlike the public getArticleBySlug this deliberately
 * returns unpublished drafts — that is the point of the editor. The
 * requireAdmin() above is what keeps the two apart.
 */
export async function getArticleForEdit(id: string) {
  await requireAdmin();

  const row = await queryOne<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    cover_url: string | null;
    is_published: number;
  }>(
    `SELECT id, slug, title, excerpt, body, cover_url, is_published
       FROM articles WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  return row ? { ...row, is_published: row.is_published === 1 } : null;
}
