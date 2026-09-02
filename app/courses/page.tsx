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
export default async function CoursesSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseCourseSearchParams(raw);

  const [{ items, totalCount }, { academicYears, subjects }] = await Promise.all([
    searchCourses(params),
    getSearchFacets(),
  ]);

  return (
    <div className="bg-bg-light py-3xl">
      <Container>
        <Badge variant="violet">الدورات</Badge>
        <h1 className="mt-3">استكشف الدورات</h1>
        <p className="mt-1 text-text-secondary-light">
          <span className="num">{totalCount}</span> دورة متاحة
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <FilterPanel params={params} academicYears={academicYears} subjects={subjects} />
          </div>

          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <SortLinks params={params} />
            </div>

            <Suspense fallback={<ResultsSkeleton />}>
              {items.length === 0 ? (
                <Card className="text-center">
                  <p className="text-[14px] text-text-secondary-light">
                    لا توجد دورات مطابقة لهذا البحث. جرّب تعديل الفلاتر.
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
