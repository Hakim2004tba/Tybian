import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProgressOverview } from "@/components/dashboard/ProgressOverview";
import { StudyTimerSection } from "@/components/dashboard/StudyTimerSection";
import { StudyLeaderboard } from "@/components/dashboard/StudyLeaderboard";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "تقدّمي" as a real route: everything about how the student is doing,
 * gathered in one place instead of scattered down the dashboard.
 *
 * Every panel here is an existing component reading existing data — the
 * page composes, it does not re-query.
 */
export default async function ProgressPage() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  return (
    <div className="flex flex-col gap-6 px-md py-lg md:px-xl md:py-xl">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary-light">{t.progress.title}</h1>
        <p className="mt-1 text-[13.5px] text-text-secondary-light">
          {t.progress.pageSubtitle}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton />}>
          <ProgressOverview />
        </Suspense>
        <div id="timer" className="scroll-mt-24">
          <Suspense fallback={<PanelSkeleton />}>
            <StudyTimerSection />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<PanelSkeleton />}>
        <StudyLeaderboard />
      </Suspense>
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
