import { Suspense } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/dashboard/Pagination";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SortLinks } from "@/components/search/SortLinks";
import { CourseSearchCard } from "@/components/search/CourseSearchCard";
import { CourseListRow } from "@/components/dashboard/explore/CourseListRow";
import { ExploreSearchBar } from "@/components/dashboard/explore/ExploreSearchBar";
import { getAllProgress } from "@/lib/data/student-dashboard";
import { getSessionUser } from "@/lib/auth/session";
import { parseCourseSearchParams, PAGE_SIZE } from "@/lib/search/params";
import { searchCourses, getSearchFacets } from "@/lib/data/course-search";
import { getDictionary } from "@/lib/i18n/locale";
import { listPacks } from "@/lib/data/packs";
import { PackCard } from "@/components/packs/PackCard";
import Link from "next/link";

/**
 * The course catalogue INSIDE the student shell.
 *
 * /courses still exists and is still the public, shareable catalogue —
 * a signed-out visitor needs it, and its links are indexable. This is
 * the same search rendered for a signed-in student so that browsing
 * courses no longer throws them out of their dashboard into the
 * marketing layout, which is what "استكشف الدورات" used to do.
 *
 * It reuses the identical data functions and components; only the
 * chrome and the pagination basePath differ. Nothing about the search
 * itself is duplicated.
 */
export default async function DashboardExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const raw = await searchParams;
  const params = parseCourseSearchParams(raw);

  const user = await getSessionUser();
  const [{ items, totalCount }, { academicYears, subjects }, progress, packs] = await Promise.all([
    searchCourses(params),
    getSearchFacets(),
    /*
      The phone rows show "42% completed" per course, which the search
      query does not know — it is catalogue data, the same for every
      visitor. Progress is the student's own, fetched once here and
      matched by course id rather than queried per row.
    */
    user ? getAllProgress(user.id) : Promise.resolve([]),
    /*
      Packs were on /courses only, which a signed-in student never sees
      — the dashboard catalogue is where they browse. An offer visible
      only to people who have not registered is an offer nobody buys.
    */
    listPacks(),
  ]);

  const percentByCourse = new Map<string, number>();
  for (const p of progress) {
    if (p.total_lessons > 0) {
      percentByCourse.set(p.course_id, Math.round((p.completed_lessons / p.total_lessons) * 100));
    }
  }

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary-light">{t.courses.explore}</h1>
        <p className="mt-1 text-[13.5px] text-text-secondary-light">
          <span className="num">{totalCount}</span> {t.courses.available}
        </p>
      </header>

      {/* Phone: the search row, chips, and the filter panel folded
          behind a button. Hidden from lg up, where the sidebar shows. */}
      <div className="mt-4">
        <ExploreSearchBar subjects={subjects}>
          <FilterPanel params={params} academicYears={academicYears} subjects={subjects} />
        </ExploreSearchBar>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <FilterPanel params={params} academicYears={academicYears} subjects={subjects} />
        </div>

        <div className="min-w-0">
          {/*
            Above the results and outside the filters, as on /courses: a
            pack is an offer on several courses at once, and folding it
            into the filtered grid would make it read as one more course
            while a subject filter quietly hid it.
          */}
          {packs.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-[17px] font-semibold text-text-primary-light">
                {dict.packs.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {packs.map((pack) => (
                  <PackCard key={pack.id} pack={pack} />
                ))}
              </div>
            </section>
          )}

          <div className="mb-5 hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <SortLinks params={params} />
          </div>

          <Suspense fallback={<ResultsSkeleton />}>
            {items.length === 0 ? (
              <div className="rounded-xl border border-white/70 bg-white px-lg py-10 text-center">
                <p className="text-[14px] text-text-secondary-light">
                  {t.courses.noMatch}
                </p>
              </div>
            ) : (
              <>
                {/* Phone: a list of compact rows. */}
                <ul className="flex flex-col gap-2.5 lg:hidden">
                  {items.map((course) => (
                    <li key={course.id}>
                      <CourseListRow
                        course={course}
                        percent={percentByCourse.get(course.id) ?? null}
                      />
                    </li>
                  ))}
                </ul>

                {/* Desktop: the existing card grid. */}
                <div className="hidden gap-5 sm:grid-cols-2 lg:grid xl:grid-cols-3">
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
                  basePath="/dashboard/explore"
                  currentParams={raw}
                />
              </>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-white/70 bg-white">
          <Skeleton className="aspect-video" />
          <div className="p-lg">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
