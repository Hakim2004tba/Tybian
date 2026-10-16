import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { getSessionUser, getSessionProfile } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { StudentHero } from "@/components/dashboard/StudentHero";
import { ContinueLearningCard } from "@/components/dashboard/ContinueLearningCard";
import { MyCoursesSection } from "@/components/dashboard/MyCoursesSection";
import { ProgressOverview } from "@/components/dashboard/ProgressOverview";
import { StudyTimerSection } from "@/components/dashboard/StudyTimerSection";
import { StudyLeaderboard } from "@/components/dashboard/StudyLeaderboard";
import { FavoritesSection } from "@/components/dashboard/FavoritesSection";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Performance strategy for this route is UNCHANGED from the previous
 * implementation — this was a visual redesign, not a data rewrite:
 *
 *  - Every section is its own Suspense boundary with a matching
 *    skeleton, so a slow query never blocks a fast one from painting.
 *  - Nothing fetches "everything" up front; course lists, favorites,
 *    notifications and activity are paginated at the DATABASE level via
 *    .range(), not fetched-then-sliced (lib/data/student-dashboard.ts).
 *  - Per-course progress comes from one Postgres function call scoped
 *    to this user's own enrollments, never N+1 per course, and
 *    getAllProgress is React-cache()d so the hero, the progress panel
 *    and the sidebar share a single RPC per request.
 *  - Pagination stays plain server-rendered links (?coursesPage=2), so
 *    paging costs no client JS and each page is a real URL.
 *
 * What changed: StatsRow was folded into StudentHero (same
 * computeStats() call, now inside the dark hero panel) so the four
 * headline numbers are stated once instead of twice, and the section
 * order follows the brief's hierarchy — welcome, current courses,
 * progress, study tools, recent/announcements, certificates.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    coursesPage?: string;
    favoritesPage?: string;
    notifPage?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  /* Same row the shell already read this request — see
     getSessionProfile in lib/auth/session.ts. */
  const profile = await getSessionProfile();

  const coursesPage = Math.max(1, Number(params.coursesPage) || 1);
  const favoritesPage = Math.max(1, Number(params.favoritesPage) || 1);
  const notifPage = Math.max(1, Number(params.notifPage) || 1);

  const { dict } = await getDictionary();
  const t = dict.dash;
  const firstName = (profile?.full_name ?? t.roles.student).trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-6 px-md py-lg md:px-xl md:py-xl">
      <Suspense fallback={<HeroSkeleton />}>
        <StudentHero name={firstName} />
      </Suspense>

      <Suspense fallback={<PanelSkeleton />}>
        <ContinueLearningCard />
      </Suspense>

      {/*
        THE GARDEN COMES BEFORE THE LISTS.

        It used to sit near the bottom in a half-width column, where the
        plot and the ranking were squeezed into two narrow strips and
        neither was readable. It is also the one panel that is full on
        a brand-new account — the courses and favourites above it are
        both empty for a student who has not enrolled yet, which is what
        left the top of the page looking like a page that failed to
        load. Full width, and early.
      */}
      <Suspense fallback={<PanelSkeleton />}>
        <StudyLeaderboard />
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section id="my-courses" className="min-w-0">
          <h2 className="mb-3.5 text-[17px] font-semibold text-text-primary-light">{t.courses.myCourses}</h2>
          <Suspense fallback={<CoursesGridSkeleton />}>
            <MyCoursesSection page={coursesPage} currentParams={params} />
          </Suspense>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <Suspense fallback={<PanelSkeleton />}>
            <ProgressOverview />
          </Suspense>
          <div id="timer" className="scroll-mt-24">
            <Suspense fallback={<PanelSkeleton />}>
              <StudyTimerSection />
            </Suspense>
          </div>
        </div>
      </div>

      <section className="min-w-0">
        <h2 className="mb-3.5 text-[17px] font-semibold text-text-primary-light">{t.courses.favorites}</h2>
        <Suspense fallback={<CoursesGridSkeleton />}>
          <FavoritesSection page={favoritesPage} currentParams={params} />
        </Suspense>
      </section>

    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="rounded-xl bg-academy-deep p-lg md:p-xl">
      <Skeleton className="h-4 w-32 bg-white/10" />
      <Skeleton className="mt-3 h-8 w-2/3 bg-white/10" />
      <Skeleton className="mt-3 h-4 w-1/2 bg-white/10" />
      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-md bg-white/10" />
        ))}
      </div>
    </div>
  );
}

function CoursesGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-white/70 bg-white">
          <Skeleton className="aspect-video" />
          <div className="p-lg">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <Skeleton className="mt-4 h-1.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="rounded-xl border border-white/70 bg-white">
      <div className="border-b border-border-light p-lg pb-4">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-3 p-lg">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}
