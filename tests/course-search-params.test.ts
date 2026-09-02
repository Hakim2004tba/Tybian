// Run with: node --experimental-strip-types tests/course-search-params.test.ts

import { parseCourseSearchParams, courseSearchParamsToQueryString } from "../lib/search/params.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) {
    console.log(`[FAIL] ${name}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

// --- Defaults on empty input ---
{
  const p = parseCourseSearchParams({});
  check("empty params: sort defaults to popular", p.sort, "popular");
  check("empty params: page defaults to 1", p.page, 1);
  check("empty params: q is null", p.q, null);
  check("empty params: yearId is null", p.yearId, null);
  check("empty params: ratingMin is null", p.ratingMin, null);
  check("empty params: duration is null", p.duration, null);
}

// --- The exact example URL from the requirement ---
{
  const p = parseCourseSearchParams({ year: "1", rating: "4", sort: "popular" });
  check("example URL: year=1", p.yearId, "1");
  check("example URL: rating=4", p.ratingMin, 4);
  check("example URL: sort=popular", p.sort, "popular");
}

// --- Malformed/tampered input degrades safely, never throws ---
{
  const p = parseCourseSearchParams({ sort: "drop-table", duration: "eternity", rating: "not-a-number", page: "-5" });
  check("invalid sort falls back to popular", p.sort, "popular");
  check("invalid duration bucket becomes null (no filter)", p.duration, null);
  check("non-numeric rating becomes null", p.ratingMin, null);
  check("negative page falls back to 1", p.page, 1);
}

// --- Rating clamped to [0, 5] ---
{
  check("rating above 5 clamps to 5", parseCourseSearchParams({ rating: "9" }).ratingMin, 5);
  check("negative rating clamps to 0", parseCourseSearchParams({ rating: "-3" }).ratingMin, 0);
}

// --- Price bounds never negative ---
{
  const p = parseCourseSearchParams({ price_min: "-100", price_max: "-1" });
  check("negative price_min clamps to 0", p.priceMin, 0);
  check("negative price_max clamps to 0", p.priceMax, 0);
}

// --- All valid sort options accepted ---
for (const sort of ["popular", "rating", "newest", "price_asc", "price_desc"]) {
  check(`valid sort "${sort}" accepted`, parseCourseSearchParams({ sort }).sort, sort);
}

// --- All valid duration buckets accepted ---
for (const duration of ["short", "medium", "long"]) {
  check(`valid duration "${duration}" accepted`, parseCourseSearchParams({ duration }).duration, duration);
}

// --- Round-trip: parse -> stringify -> parse again is stable ---
{
  const original = parseCourseSearchParams({ year: "2", rating: "4", sort: "price_asc", q: "تشريح", page: "3" });
  const qs = courseSearchParamsToQueryString(original);
  const reparsed = parseCourseSearchParams(Object.fromEntries(new URLSearchParams(qs)));
  check("round-trip preserves yearId", reparsed.yearId, original.yearId);
  check("round-trip preserves ratingMin", reparsed.ratingMin, original.ratingMin);
  check("round-trip preserves sort", reparsed.sort, original.sort);
  check("round-trip preserves q", reparsed.q, original.q);
  check("round-trip preserves page", reparsed.page, original.page);
}

// --- Default sort/page omitted from the query string (clean URLs) ---
{
  const qs = courseSearchParamsToQueryString({ sort: "popular", page: 1, yearId: "1" });
  check("default sort not included in URL", qs.includes("sort="), false);
  check("default page not included in URL", qs.includes("page="), false);
  check("non-default filter still included", qs.includes("year=1"), true);
}

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
