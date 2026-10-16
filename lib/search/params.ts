/**
 * Pure parsing of /courses search params into a typed, validated
 * structure — kept dependency-free (no Next.js imports) so it's
 * directly unit-testable, same pattern as lib/auth/route-access.ts and
 * lib/video/access.ts. The page component is the only thing that reads
 * raw `searchParams`; everything else works with this typed shape.
 */

export type SortOption = "popular" | "rating" | "newest" | "price_asc" | "price_desc";

export type SortKey = "popular" | "rating" | "newest" | "priceAsc" | "priceDesc";

export const SORT_OPTIONS: { value: SortOption; key: SortKey }[] = [
  /* `key` indexes dict.pages.sort — the wording follows the reader
     while `value`, which goes into the URL, never changes, so a shared
     link keeps working whatever language opened it. */
  { value: "popular", key: "popular" },
  { value: "rating", key: "rating" },
  { value: "newest", key: "newest" },
  { value: "price_asc", key: "priceAsc" },
  { value: "price_desc", key: "priceDesc" },
];

export type DurationBucket = "short" | "medium" | "long";

/** Minute ranges backing each duration filter bucket — exported so the
 *  query layer and any UI label stay in sync with one definition. */
export const DURATION_RANGES: Record<DurationBucket, { min: number; max: number | null }> = {
  short: { min: 0, max: 120 }, // under 2 hours
  medium: { min: 120, max: 600 }, // 2–10 hours
  long: { min: 600, max: null }, // 10+ hours
};

export type CourseSearchParams = {
  q: string | null;
  yearId: string | null;
  subject: string | null;
  ratingMin: number | null;
  priceMin: number | null;
  priceMax: number | null;
  duration: DurationBucket | null;
  sort: SortOption;
  page: number;
};

const VALID_SORTS: SortOption[] = ["popular", "rating", "newest", "price_asc", "price_desc"];
const VALID_DURATIONS: DurationBucket[] = ["short", "medium", "long"];
const PAGE_SIZE = 12;

export { PAGE_SIZE };

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Every field defaults to "no filter" / a safe value on anything
 * malformed — a tampered or stale URL degrades to "show everything",
 * never to a thrown error or an unbounded query.
 */
export function parseCourseSearchParams(raw: Record<string, string | undefined>): CourseSearchParams {
  const sort = VALID_SORTS.includes(raw.sort as SortOption) ? (raw.sort as SortOption) : "popular";
  const duration = VALID_DURATIONS.includes(raw.duration as DurationBucket)
    ? (raw.duration as DurationBucket)
    : null;

  const ratingMinRaw = parseNumber(raw.rating);
  const ratingMin = ratingMinRaw !== null ? Math.min(5, Math.max(0, ratingMinRaw)) : null;

  const priceMinRaw = parseNumber(raw.price_min);
  const priceMin = priceMinRaw !== null ? Math.max(0, priceMinRaw) : null;

  const priceMaxRaw = parseNumber(raw.price_max);
  const priceMax = priceMaxRaw !== null ? Math.max(0, priceMaxRaw) : null;

  const pageRaw = parseNumber(raw.page);
  const page = pageRaw !== null && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return {
    q: raw.q?.trim() || null,
    yearId: raw.year || null,
    subject: raw.subject || null,
    ratingMin,
    priceMin,
    priceMax,
    duration,
    sort,
    page,
  };
}

/** Builds the query-string form of a params object — used by filter
 *  links/forms so every control stays URL-based (?year=1&rating=4&sort=popular)
 *  rather than client-side state. */
export function courseSearchParamsToQueryString(params: Partial<CourseSearchParams>): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.yearId) qs.set("year", params.yearId);
  if (params.subject) qs.set("subject", params.subject);
  if (params.ratingMin) qs.set("rating", String(params.ratingMin));
  if (params.priceMin) qs.set("price_min", String(params.priceMin));
  if (params.priceMax) qs.set("price_max", String(params.priceMax));
  if (params.duration) qs.set("duration", params.duration);
  if (params.sort && params.sort !== "popular") qs.set("sort", params.sort);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  return qs.toString();
}
