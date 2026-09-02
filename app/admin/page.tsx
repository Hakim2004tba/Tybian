import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardStats } from "@/components/admin/dashboard/DashboardStats";
import {
  StudentGrowthChartCard,
  RevenueChartCard,
  CourseSalesChartCard,
  WatchTimeChartCard,
} from "@/components/admin/dashboard/DashboardCharts";
import {
  RecentStudentsTable,
  RecentPaymentsTable,
  RecentReviewsTable,
} from "@/components/admin/dashboard/DashboardTables";

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex items-start gap-3.5">
          <Skeleton className="h-11 w-11 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-3 w-44" />
      <Skeleton className="mt-5 h-[180px] w-full" />
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-3 p-lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </Card>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="gold">لوحة الإدارة</Badge>
        <h1 className="mt-3 text-2xl">نظرة عامة</h1>
        <p className="mt-1 text-text-secondary-light">ملخص أداء منصة تبيان.</p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          <StudentGrowthChartCard />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChartCard />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <CourseSalesChartCard />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <WatchTimeChartCard />
        </Suspense>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Suspense fallback={<TableSkeleton />}>
          <RecentStudentsTable />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <RecentPaymentsTable />
        </Suspense>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <RecentReviewsTable />
      </Suspense>
    </div>
  );
}
