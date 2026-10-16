import "server-only";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";

const PAGE_SIZE = 15;

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  status: string;
  created_at: string;
};

/**
 * Contact messages, admin only.
 *
 * contact_messages had an insert-for-anyone policy and NO select policy
 * for non-admins at all, so this read was impossible for a normal user
 * however it was called. requireAdmin() is what carries that guarantee
 * now — the page's layout guard is a second line, not the only one,
 * because a data function that leaks when called from the wrong place is
 * a function waiting to be called from the wrong place.
 */
export async function listContactMessages(page: number) {
  await requireAdmin();

  const offset = (page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    query<ContactMessageRow>(
      `SELECT id, name, email, subject, body, status, created_at
         FROM contact_messages
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [PAGE_SIZE, offset]
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM contact_messages`),
  ]);

  return { items, totalCount: Number(total?.n ?? 0), page, pageSize: PAGE_SIZE };
}
