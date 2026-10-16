import "server-only";
import { query, queryOne } from "@/lib/db";

/**
 * Public article reads.
 *
 * `is_published = 1 AND deleted_at IS NULL` is the authorization, exactly
 * as the Postgres policy had it: an unpublished draft must not be
 * reachable by guessing its slug. Both halves appear in both functions
 * below — an admin preview would need its own path, deliberately, rather
 * than a flag that relaxes these.
 */

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

type ListRow = Omit<ArticleListItem, "author"> & { author_name: string | null };

export async function getPublishedArticles(page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const [rows, total] = await Promise.all([
      query<ListRow>(
        `SELECT a.id, a.slug, a.title, a.excerpt, a.cover_url, a.published_at,
                p.full_name AS author_name
           FROM articles a
           LEFT JOIN profiles p ON p.id = a.author_id
          WHERE a.is_published = 1 AND a.deleted_at IS NULL
          ORDER BY a.published_at DESC
          LIMIT ? OFFSET ?`,
        [PAGE_SIZE, offset]
      ),
      queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM articles WHERE is_published = 1 AND deleted_at IS NULL`
      ),
    ]);

    const items: ArticleListItem[] = rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      cover_url: a.cover_url,
      published_at: a.published_at,
      // LEFT JOIN: the author is nullable (ON DELETE SET NULL), so an
      // article outlives the account that wrote it rather than vanishing.
      author: a.author_name ? { full_name: a.author_name } : null,
    }));

    return { items, totalCount: Number(total?.n ?? 0), page, pageSize: PAGE_SIZE };
  } catch {
    return { items: [], totalCount: 0, page, pageSize: PAGE_SIZE };
  }
}

export type ArticleDetail = ArticleListItem & { body: string };

export async function getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const row = await queryOne<ListRow & { body: string }>(
    `SELECT a.id, a.slug, a.title, a.excerpt, a.body, a.cover_url, a.published_at,
            p.full_name AS author_name
       FROM articles a
       LEFT JOIN profiles p ON p.id = a.author_id
      WHERE a.slug = ? AND a.is_published = 1 AND a.deleted_at IS NULL`,
    [slug]
  );

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    cover_url: row.cover_url,
    published_at: row.published_at,
    author: row.author_name ? { full_name: row.author_name } : null,
  };
}
