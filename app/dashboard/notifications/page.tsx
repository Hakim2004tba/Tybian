import { Suspense } from "react";
import { NotificationsSection } from "@/components/dashboard/NotificationsSection";
import { Skeleton } from "@/components/ui/Skeleton";

export const dynamic = "force-dynamic";

/**
 * The student's notifications.
 *
 * WHY THIS PAGE EXISTS: NotificationsSection was written, complete and
 * working — and rendered by nothing. The bell in the topbar pointed at
 * `/dashboard#notifications`, an anchor on a page that has no such
 * section, so clicking it moved the student to the dashboard and
 * showed them nothing. Rows were being written and there was nowhere
 * to read them.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.notificationsPage ?? "1") || 1);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <NotificationsSection page={page} currentParams={params} />
      </Suspense>
    </div>
  );
}
