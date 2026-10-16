import "server-only";
import { query, queryOne, toArray, type SqlValue } from "@/lib/db";
import { DURATION_RANGES, PAGE_SIZE, type CourseSearchParams } from "@/lib/search/params";

export type CourseSearchResult = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  level: string;
  rating: number;
  rating_count: number;
  students_count: number;
  duration_minutes: number;
  lessons_count: number;
  min_price: number | null;
  academic_years: { name_ar: string } | null;
  teachers: { profiles: { full_name: string } | null } | null;
};

export type CourseSearchResponse = {
  items: CourseSearchResult[];
  totalCount: number;
};

type Row = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  level: string;
  rating: string;
  rating_count: number;
  students_count: number;
  duration_minutes: number;
  lessons_count: number;
  min_price: string | null;
  year_name: string | null;
  teacher_name: string | null;
};

/*
  Sort is chosen from a fixed map, never built from the parameter.

  `params.sort` arrives from the query string. Everything else in this
  file is bound as a `?` placeholder, but ORDER BY cannot be — so the
  only safe form is a lookup whose values are literals written here. An
  unrecognised sort falls to the default rather than reaching SQL.
*/
const SORTS: Record<string, string> = {
  rating: "c.rating DESC, c.rating_count DESC",
  newest: "c.created_at DESC",
  // NULL min_price sorts last either way: MariaDB puts NULLs first on
  // ASC and last on DESC, so DESC needs no help and ASC gets an explicit
  // "nulls last" via the leading IS NULL test. This matches the
  // `nullsFirst: false` the Supabase version asked for in both cases.
  price_asc: "c.min_price IS NULL ASC, c.min_price ASC",
  price_desc: "c.min_price DESC",
  popular: "c.students_count DESC",
};

/**
 * The whole filter/sort/search pipeline is SQL — this returns at most
 * PAGE_SIZE rows, and nothing upstream ever fetches "all courses" and
 * narrows in JavaScript.
 *
 * Public: results are restricted to published, non-deleted courses, and
 * that restriction is the authorization. It is applied first, in the
 * shared WHERE below, so no filter combination can reach around it.
 *
 * One index note carried over from 0025_course_search.sql: `q` used a
 * GIN trigram index there. MariaDB has no trigram index, and a leading
 * wildcard LIKE cannot use a B-tree, so this scans. At this catalogue's
 * size that is genuinely fine; the FULLTEXT index on `search_text` in
 * the schema is there for when it is not, and switching to MATCH…AGAINST
 * is a change to this one clause.
 */
export async function searchCourses(params: CourseSearchParams): Promise<CourseSearchResponse> {
  const where: string[] = ["c.status = 'published'", "c.deleted_at IS NULL"];
  const args: SqlValue[] = [];

  if (params.q) {
    where.push("c.search_text LIKE ?");
    // Escape the LIKE metacharacters, or a query containing % matches
    // everything and _ matches any character.
    const escaped = params.q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    args.push(`%${escaped}%`);
  }

  if (params.yearId) {
    where.push("c.academic_year_id = ?");
    args.push(params.yearId);
  }

  if (params.subject) {
    // `tags` was a Postgres text[] queried with `contains`; it is a JSON
    // array now. JSON_QUOTE makes the needle a JSON string so the match
    // is by element, not by substring of the serialised array.
    where.push("JSON_CONTAINS(c.tags, JSON_QUOTE(?))");
    args.push(params.subject);
  }

  if (params.ratingMin) {
    where.push("c.rating >= ?");
    args.push(params.ratingMin);
  }

  if (params.priceMin !== null) {
    where.push("c.min_price >= ?");
    args.push(params.priceMin);
  }
  if (params.priceMax !== null) {
    where.push("c.min_price <= ?");
    args.push(params.priceMax);
  }

  if (params.duration) {
    const range = DURATION_RANGES[params.duration];
    where.push("c.duration_minutes >= ?");
    args.push(range.min);
    if (range.max !== null) {
      where.push("c.duration_minutes < ?");
      args.push(range.max);
    }
  }

  const whereSql = where.join(" AND ");
  const orderSql = SORTS[params.sort] ?? SORTS.popular;
  const offset = (params.page - 1) * PAGE_SIZE;

  try {
    /*
      Two queries rather than one.

      Supabase returned the page and the total together via `count:
      "exact"`. MariaDB's equivalent, SQL_CALC_FOUND_ROWS, is deprecated
      and slower than simply asking twice — and the COUNT does not touch
      the joins, since nothing in the WHERE clause depends on them.
    */
    const [rows, total] = await Promise.all([
      query<Row>(
        `SELECT c.id, c.slug, c.title, c.cover_url, c.level, c.rating, c.rating_count,
                c.students_count, c.duration_minutes, c.lessons_count, c.min_price,
                ay.name_ar  AS year_name,
                p.full_name AS teacher_name
           FROM courses c
           LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
           LEFT JOIN teachers t        ON t.id  = c.teacher_id
           LEFT JOIN profiles p        ON p.id  = t.profile_id
          WHERE ${whereSql}
          ORDER BY ${orderSql}
          LIMIT ? OFFSET ?`,
        [...args, PAGE_SIZE, offset]
      ),
      queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM courses c WHERE ${whereSql}`, args),
    ]);

    const items: CourseSearchResult[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      cover_url: row.cover_url,
      level: row.level,
      rating: Number(row.rating),
      rating_count: row.rating_count,
      students_count: row.students_count,
      duration_minutes: row.duration_minutes,
      lessons_count: row.lessons_count,
      min_price: row.min_price === null ? null : Number(row.min_price),
      academic_years: row.year_name ? { name_ar: row.year_name } : null,
      teachers: row.teacher_name ? { profiles: { full_name: row.teacher_name } } : null,
    }));

    return { items, totalCount: Number(total?.n ?? 0) };
  } catch {
    return { items: [], totalCount: 0 };
  }
}

/** Facet data for the filter panel. */
export async function getSearchFacets(): Promise<{
  academicYears: { id: string; name_ar: string; year_number: number }[];
  subjects: string[];
}> {
  try {
    const [years, tagRows] = await Promise.all([
      query<{ id: string; name_ar: string; year_number: number }>(
        `SELECT id, name_ar, year_number FROM academic_years ORDER BY sort_order`
      ),
      /*
        Tags are still tallied in JavaScript.

        Counting them in SQL would need a JSON table function that
        MariaDB does not have, and the 500-row cap the Supabase version
        already imposed keeps this bounded. The cap means the facet list
        reflects the first 500 published courses rather than all of them
        — inherited behaviour, and acceptable for a filter panel that
        only shows the top 20 tags anyway.
      */
      query<{ tags: unknown }>(
        `SELECT tags FROM courses
          WHERE status = 'published' AND deleted_at IS NULL
            AND tags IS NOT NULL AND JSON_LENGTH(tags) > 0
          LIMIT 500`
      ),
    ]);

    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      for (const tag of toArray<string>(row.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const subjects = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);

    return { academicYears: years, subjects };
  } catch {
    return { academicYears: [], subjects: [] };
  }
}
