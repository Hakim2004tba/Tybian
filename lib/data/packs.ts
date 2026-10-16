import "server-only";
import { query, queryOne } from "@/lib/db";
import { tablesExist } from "@/lib/db/tables";

export const PACK_TABLES = ["course_packs", "course_pack_items"];

export type PackCourse = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  lessons_count: number;
  /** The course's own cheapest active price, for the saving. */
  own_price: number | null;
};

export type PackPlan = {
  planType: "three_months" | "lifetime";
  price: number;
  currency: string;
  /** null = lifetime. */
  durationDays: number | null;
};

export type Pack = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  /**
   * The CHEAPEST active plan, kept so cards and the saving keep
   * working unchanged. The plans themselves are below.
   */
  price: number;
  currency: string;
  /** What the student chooses between. Empty until 18-pack-plans.sql. */
  plans: PackPlan[];
  courses: PackCourse[];
  /** Sum of the courses' own prices. */
  separateTotal: number;
  /** What the pack saves. Never negative, never invented. */
  saving: number;
};

/**
 * Packs, with their courses and the real saving.
 *
 * THE SAVING IS COMPUTED, NOT STORED. An admin typing "save 1300 DA"
 * into a field is typing a number that is true on the day they type it
 * and false the first time a course price moves — and a platform
 * advertising a discount it no longer gives has done something worse
 * than not advertising one. So it is the difference between the pack's
 * price and the sum of what those courses cost separately, read fresh
 * every time.
 *
 * A course with no active price contributes nothing to the comparison
 * rather than zero: "free" would inflate the saving, and skipping it
 * understates it. Understating is the safe direction.
 */
export async function listPacks(): Promise<Pack[]> {
  if (!(await tablesExist(PACK_TABLES))) return [];

  const packs = await query<{
    id: string; slug: string; title: string; description: string | null;
    cover_url: string | null; price: string; currency: string;
  }>(
    `SELECT id, slug, title, description, cover_url, price, currency
       FROM course_packs
      WHERE is_active = 1 AND deleted_at IS NULL
      ORDER BY sort_order, created_at DESC`
  );
  if (packs.length === 0) return [];

  const ids = packs.map((p) => p.id);

  /*
    Asked separately and guarded, because course_pack_prices arrives in
    migration 18: joining it in the main query would take the whole
    packs page down on a server that has not run it yet, instead of
    quietly falling back to the single stored price.
  */
  const hasPlans = await tablesExist(["course_pack_prices"]);
  const planRows = hasPlans
    ? await query<{
        pack_id: string; plan_type: PackPlan["planType"];
        price: string; currency: string; duration_days: number | null;
      }>(
        `SELECT pack_id, plan_type, price, currency, duration_days
           FROM course_pack_prices
          WHERE is_active = 1 AND pack_id IN (${ids.map(() => "?").join(",")})
          ORDER BY (duration_days IS NULL), duration_days`,
        ids
      )
    : [];
  const items = await query<{
    pack_id: string; id: string; slug: string; title: string;
    cover_url: string | null; lessons_count: number; own_price: string | null;
  }>(
    `SELECT i.pack_id, c.id, c.slug, c.title, c.cover_url,
            (SELECT COUNT(*) FROM lessons l
               JOIN course_sections s ON s.id = l.section_id
              WHERE s.course_id = c.id AND l.deleted_at IS NULL) AS lessons_count,
            (SELECT MIN(cp.price) FROM course_prices cp
              WHERE cp.course_id = c.id AND cp.is_active = 1) AS own_price
       FROM course_pack_items i
       JOIN courses c ON c.id = i.course_id
      WHERE i.pack_id IN (${ids.map(() => "?").join(",")})
        AND c.deleted_at IS NULL
      ORDER BY i.sort_order`,
    ids
  );

  return packs.map((p) => {
    const courses: PackCourse[] = items
      .filter((i) => i.pack_id === p.id)
      .map((i) => ({
        id: i.id,
        slug: i.slug,
        title: i.title,
        cover_url: i.cover_url,
        lessons_count: Number(i.lessons_count),
        own_price: i.own_price === null ? null : Number(i.own_price),
      }));

    const plans: PackPlan[] = planRows
      .filter((r) => r.pack_id === p.id)
      .map((r) => ({
        planType: r.plan_type,
        price: Number(r.price),
        currency: r.currency,
        durationDays: r.duration_days === null ? null : Number(r.duration_days),
      }));

    const separateTotal = courses.reduce((sum, c) => sum + (c.own_price ?? 0), 0);
    /* The headline figure is the cheapest way in, which is what a card
       showing one number should say. Falls back to the pack's own
       column when no plans exist yet. */
    const price = plans.length > 0
      ? Math.min(...plans.map((pl) => pl.price))
      : Number(p.price);

    return {
      ...p,
      price,
      plans,
      courses,
      separateTotal,
      /* Never negative: a pack priced above its parts saves nothing,
         and showing "save -200" would be absurd. */
      saving: Math.max(0, Math.round(separateTotal - price)),
    };
  });
}

export async function getPackBySlug(slug: string): Promise<Pack | null> {
  const packs = await listPacks();
  return packs.find((p) => p.slug === slug) ?? null;
}

export async function getPackById(id: string): Promise<Pack | null> {
  const packs = await listPacks();
  return packs.find((p) => p.id === id) ?? null;
}

/**
 * The packs a given course belongs to — for the banner on its page.
 *
 * This is the upsell that actually converts: the student is already
 * reading about the course, and "two more for a little extra" lands
 * better here than on a catalogue page they scrolled past.
 */
export async function packsContaining(courseId: string): Promise<Pack[]> {
  if (!(await tablesExist(PACK_TABLES))) return [];
  const rows = await query<{ pack_id: string }>(
    `SELECT i.pack_id
       FROM course_pack_items i
       JOIN course_packs p ON p.id = i.pack_id
      WHERE i.course_id = ? AND p.is_active = 1 AND p.deleted_at IS NULL`,
    [courseId]
  );
  if (rows.length === 0) return [];

  const all = await listPacks();
  const wanted = new Set(rows.map((r) => r.pack_id));
  return all.filter((p) => wanted.has(p.id));
}

/** Which of a pack's courses the student already has. */
export async function alreadyOwned(userId: string, packId: string): Promise<string[]> {
  if (!(await tablesExist(PACK_TABLES))) return [];
  const rows = await query<{ course_id: string }>(
    `SELECT e.course_id
       FROM enrollments e
       JOIN course_pack_items i ON i.course_id = e.course_id
      WHERE i.pack_id = ? AND e.user_id = ?
        AND e.deleted_at IS NULL
        AND e.starts_at <= UTC_TIMESTAMP(3)
        AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))`,
    [packId, userId]
  );
  return rows.map((r) => r.course_id);
}

export async function packsReady(): Promise<boolean> {
  return tablesExist(PACK_TABLES);
}
