import "server-only";
import { createClient } from "@/lib/supabase/server";
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
  min_price: number | null;
  academic_years: { name_ar: string } | null;
  teachers: { profiles: { full_name: string } | null } | null;
};

export type CourseSearchResponse = {
  items: CourseSearchResult[];
  totalCount: number;
};

/**
 * The entire filter/sort/search pipeline is Postgres WHERE/ORDER BY —
 * this function returns at most PAGE_SIZE rows; nothing upstream ever
 * fetches "all courses" and narrows in JavaScript. Every clause here
 * maps to a real index from 0025_course_search.sql:
 *   q          -> search_text (GIN trigram)
 *   yearId     -> academic_year_id (idx_courses_published_year_students)
 *   subject    -> tags (GIN, idx_courses_tags from 0003)
 *   ratingMin  -> rating (idx_courses_rating)
 *   price      -> min_price (idx_courses_min_price)
 *   duration   -> duration_minutes (idx_courses_duration_minutes)
 *   sort       -> students_count / rating / created_at / min_price, all indexed
 */
export async function searchCourses(params: CourseSearchParams): Promise<CourseSearchResponse> {
  const supabase = await createClient();

  let query = supabase
    .from("courses")
    .select(
      `id, slug, title, cover_url, level, rating, rating_count, students_count, duration_minutes, min_price,
       academic_years ( name_ar ),
       teachers ( profiles ( full_name ) )`,
      { count: "exact" }
    )
    .eq("status", "published")
    .is("deleted_at", null);

  if (params.q) {
    query = query.ilike("search_text", `%${params.q}%`);
  }

  if (params.yearId) {
    query = query.eq("academic_year_id", params.yearId);
  }

  if (params.subject) {
    query = query.contains("tags", [params.subject]);
  }

  if (params.ratingMin) {
    query = query.gte("rating", params.ratingMin);
  }

  if (params.priceMin !== null) {
    query = query.gte("min_price", params.priceMin);
  }
  if (params.priceMax !== null) {
    query = query.lte("min_price", params.priceMax);
  }

  if (params.duration) {
    const range = DURATION_RANGES[params.duration];
    query = query.gte("duration_minutes", range.min);
    if (range.max !== null) query = query.lt("duration_minutes", range.max);
  }

  switch (params.sort) {
    case "rating":
      query = query.order("rating", { ascending: false }).order("rating_count", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("min_price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("min_price", { ascending: false, nullsFirst: false });
      break;
    case "popular":
    default:
      query = query.order("students_count", { ascending: false });
      break;
  }

  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, count } = await query;

  const items: CourseSearchResult[] = (data ?? []).map((row) => {
    const yearRaw = Array.isArray(row.academic_years) ? row.academic_years[0] : row.academic_years;
    const teacherRaw = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
    const profileRaw = teacherRaw
      ? (Array.isArray(teacherRaw.profiles) ? teacherRaw.profiles[0] : teacherRaw.profiles)
      : null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      cover_url: row.cover_url,
      level: row.level,
      rating: row.rating,
      rating_count: row.rating_count,
      students_count: row.students_count,
      duration_minutes: row.duration_minutes,
      min_price: row.min_price,
      academic_years: yearRaw ?? null,
      teachers: teacherRaw ? { profiles: profileRaw ?? null } : null,
    };
  });

  return { items, totalCount: count ?? 0 };
}

/** Facet data for the filter panel. */
export async function getSearchFacets(): Promise<{
  academicYears: { id: string; name_ar: string; year_number: number }[];
  subjects: string[];
}> {
  const supabase = await createClient();

  const [{ data: years }, { data: tagRows }] = await Promise.all([
    supabase.from("academic_years").select("id, name_ar, year_number").order("sort_order"),
    supabase
      .from("courses")
      .select("tags")
      .eq("status", "published")
      .is("deleted_at", null)
      .not("tags", "eq", "{}")
      .limit(500),
  ]);

  const tagCounts = new Map<string, number>();
  (tagRows ?? []).forEach((row) => {
    (row.tags ?? []).forEach((tag: string) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
  });
  const subjects = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  return { academicYears: years ?? [], subjects };
}
