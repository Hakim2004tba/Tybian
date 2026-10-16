import { SignedInShell } from "@/components/dashboard/StudentShell";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/dashboard/Pagination";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SortLinks } from "@/components/search/SortLinks";
import { CourseSearchCard } from "@/components/search/CourseSearchCard";
import { parseCourseSearchParams, PAGE_SIZE } from "@/lib/search/params";
import { searchCourses, getSearchFacets } from "@/lib/data/course-search";
import { getDictionary } from "@/lib/i18n/locale";
import { listPacks } from "@/lib/data/packs";
import { PackCard } from "@/components/packs/PackCard";
import Link from "next/link";

/**
 * /courses?year=1&rating=4&sort=popular — fully URL-based search per
 * the requirement. Every filter/sort control here is either a plain
 * <form method="GET"> or a <Link> with a merged query string (see
 * FilterPanel.tsx / SortLinks.tsx) — no client-side state at all, so
 * the URL is always the single source of truth and every result page
 * is a real, shareable, cacheable link.
 *
 * Performance: searchCourses() does the filtering/sorting/pagination
 * entirely in Postgres (see lib/data/course-search.ts) — this page
 * never receives more than PAGE_SIZE course rows from the database,
 * let alone "all courses" filtered client-side.
 */
async function CoursesSearchPageInner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { dict } = await getDictionary();
  const t = dict.learn;
  const raw = await searchParams;
  const params = parseCourseSearchParams(raw);

  const [{ items, totalCount }, { academicYears, subjects }] = await Promise.all([
    searchCourses(params),
    getSearchFacets(),
  ]);
  const packs = await listPacks();

  return (
    <div className="bg-bg-light py-3xl">
      <Container>
        <Badge variant="violet">{t.catalog.title}</Badge>
        <h1 className="mt-3">{t.catalog.explore}</h1>
        <p className="mt-1 text-text-secondary-light">
          <span className="num">{totalCount}</span> {t.catalog.available}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <FilterPanel params={params} academicYears={academicYears} subjects={subjects} />
          </div>

          <div>
            {/*
              Packs sit ABOVE the results and outside the filters: they
              are an offer on several courses at once, and folding them
              into a filtered grid would make them look like one more
              course while a subject filter quietly hid them.
            */}
            {packs.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-[17px] font-semibold text-text-primary-light">
                  {dict.packs.title}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {packs.map((pack) => (
                    <PackCard key={pack.id} pack={pack} />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <SortLinks params={params} />
            </div>

            <Suspense fallback={<ResultsSkeleton />}>
              {items.length === 0 ? (
                <Card className="text-center">
                  <p className="text-[14px] text-text-secondary-light">
                    {t.catalog.noMatch}
                  </p>
                </Card>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((course, i) => (
                      <Reveal key={course.id} delay={Math.min(i, 6) * 50}>
                        <CourseSearchCard course={course} />
                      </Reveal>
                    ))}
                  </div>
                  <Pagination
                    page={params.page}
                    pageSize={PAGE_SIZE}
                    totalCount={totalCount}
                    paramName="page"
                    basePath="/courses"
                    currentParams={raw}
                  />
                </>
              )}
            </Suspense>
          </div>
        </div>
      </Container>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} padded={false} className="overflow-hidden">
          <Skeleton className="aspect-video" />
          <div className="p-lg">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/*
  The student shell is applied HERE rather than in a shared
  app/courses/layout.tsx, because the one page under /courses that must
  NOT have it — the lesson player — is nested below that layout and a
  child cannot opt out of an ancestor. Wrapping the two pages that want
  the rail keeps the player full-width without moving its URL.
*/
export default async function CoursesSearchPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <SignedInShell>
      <CoursesSearchPageInner {...props} />
    </SignedInShell>
  );
}
