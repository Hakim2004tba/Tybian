import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { WelcomeSection } from "@/components/dashboard/WelcomeSection";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { ContinueLearningCard } from "@/components/dashboard/ContinueLearningCard";
import { MyCoursesSection } from "@/components/dashboard/MyCoursesSection";
import { FavoritesSection } from "@/components/dashboard/FavoritesSection";
import { NotificationsSection } from "@/components/dashboard/NotificationsSection";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";
import { ReviewQueue } from "@/components/dashboard/ReviewQueue";
import { StudyTimerSection } from "@/components/dashboard/StudyTimerSection";
import { StudyLeaderboard } from "@/components/dashboard/StudyLeaderboard";

/**
 * Performance strategy for this route (per the explicit requirements):
 *
 *  - Every section is its own Suspense boundary with a matching
 *    skeleton, so a slow query (e.g. notifications) never blocks a fast
 *    one (e.g. the welcome header) from painting — same pattern as the
 *    admin dashboard (components/admin/dashboard/*).
 *  - Nothing fetches "everything" up front. Course lists, favorites,
 *    notifications, and activity are all paginated at the DATABASE
 *    query level (LIMIT/OFFSET via .range()), not fetched-then-sliced
 *    in JS — see lib/data/student-dashboard.ts.
 *  - Per-course progress (the expensive-looking part) is answered by a
 *    single Postgres function call scoped to either "this user's full
 *    enrollment set" (for stats — bounded by their own data, not
 *    global) or "just this page's course ids" (for the paginated grid)
 *    — never N+1 queries per course.
 *  - Pagination is plain server-rendered links (?coursesPage=2 etc.),
 *    so navigating a page sends no extra client JS and each page is a
 *    real, cacheable URL.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    coursesPage?: string;
    favoritesPage?: string;
    notifPage?: string;
    activityPage?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const coursesPage = Math.max(1, Number(params.coursesPage) || 1);
  const favoritesPage = Math.max(1, Number(params.favoritesPage) || 1);
  const notifPage = Math.max(1, Number(params.notifPage) || 1);
  const activityPage = Math.max(1, Number(params.activityPage) || 1);

  return (
    <Container className="flex flex-col gap-8 py-3xl">
      <WelcomeSection name={profile?.full_name ?? "طالب"} />

      <Suspense fallback={<StatsRowSkeleton />}>
        <StatsRow />
      </Suspense>

      <Suspense fallback={<ContinueLearningSkeleton />}>
        <ContinueLearningCard />
      </Suspense>

      <section>
        <h2 className="mb-4 text-[18px]">دوراتي</h2>
        <Suspense fallback={<CoursesGridSkeleton />}>
          <MyCoursesSection page={coursesPage} currentParams={params} />
        </Suspense>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton />}>
          <StudyTimerSection />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <StudyLeaderboard />
        </Suspense>
      </div>

      <Suspense fallback={<PanelSkeleton />}>
        <ReviewQueue />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton />}>
          <NotificationsSection page={notifPage} currentParams={params} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <RecentActivitySection page={activityPage} currentParams={params} />
        </Suspense>
      </div>

      <section>
        <h2 className="mb-4 text-[18px]">المفضلة</h2>
        <Suspense fallback={<CoursesGridSkeleton />}>
          <FavoritesSection page={favoritesPage} currentParams={params} />
        </Suspense>
      </section>
    </Container>
  );
}

function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ContinueLearningSkeleton() {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1fr_1.3fr]">
        <Skeleton className="aspect-video md:aspect-auto" />
        <div className="p-lg">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-4 h-1.5 w-full" />
          <Skeleton className="mt-5 h-9 w-32" />
        </div>
      </div>
    </Card>
  );
}

function CoursesGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} padded={false} className="overflow-hidden">
          <Skeleton className="aspect-video" />
          <div className="p-lg">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <Skeleton className="mt-4 h-1.5 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-3 p-lg">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </Card>
  );
}
