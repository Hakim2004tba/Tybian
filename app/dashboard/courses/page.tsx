import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { MyCoursesSection } from "@/components/dashboard/MyCoursesSection";
import { FavoritesSection } from "@/components/dashboard/FavoritesSection";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "دوراتي" as a real route rather than an anchor on the dashboard.
 *
 * Reuses the exact same paginated sections the dashboard renders — no
 * duplicated query, no second copy of the card. The only difference is
 * that here they get the full width and their own URL, so ?coursesPage=2
 * is linkable and the back button works.
 */
export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ coursesPage?: string; favoritesPage?: string }>;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const params = await searchParams;
  const coursesPage = Math.max(1, Number(params.coursesPage) || 1);
  const favoritesPage = Math.max(1, Number(params.favoritesPage) || 1);

  return (
    <div className="flex flex-col gap-8 px-md py-lg md:px-xl md:py-xl">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary-light">{t.courses.myCourses}</h1>
        <p className="mt-1 text-[13.5px] text-text-secondary-light">
          {t.courses.allEnrolled}
        </p>
      </header>

      <section>
        <Suspense fallback={<GridSkeleton />}>
          <MyCoursesSection page={coursesPage} currentParams={params} />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-3.5 text-[17px] font-semibold text-text-primary-light">{t.courses.favorites}</h2>
        <Suspense fallback={<GridSkeleton />}>
          <FavoritesSection page={favoritesPage} currentParams={params} />
        </Suspense>
      </section>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
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
