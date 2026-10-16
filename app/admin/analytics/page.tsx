import Link from "next/link";
import { Users, UserCheck, UserPlus, ClipboardCheck, Wallet, Star, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getPlatformOverview, getPopularCourses } from "@/lib/analytics/queries";
import { refreshPlatformAnalyticsAction } from "@/lib/admin/actions/analytics";
import { RefreshAnalyticsButton } from "@/components/admin/analytics/RefreshAnalyticsButton";
import { formatHoursMinutes } from "@/lib/format/duration";

const currency = new Intl.NumberFormat("en-US");

/**
 * Every number on this page comes from analytics_snapshots — nothing
 * here scans profiles/enrollments/payments live. If the snapshot is
 * empty (never refreshed), the page shows an honest empty state instead
 * of silently falling back to a live query.
 */
export default async function AdminAnalyticsPage() {
  const [overview, popularCourses] = await Promise.all([getPlatformOverview(), getPopularCourses()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="gold">التحليلات</Badge>
          <h1 className="mt-3 text-2xl">نظرة عامة على المنصة</h1>
        </div>
        <RefreshAnalyticsButton action={refreshPlatformAnalyticsAction} computedAt={overview?.computedAt ?? null} />
      </div>

      {!overview ? (
        <Card>
          <p className="text-[14px] text-text-secondary-light">
            لم تُحسب التحليلات بعد — اضغط &quot;تحديث الآن&quot; لعرض البيانات.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Users} value={currency.format(overview.value.total_students)} label="إجمالي الطلاب" />
            <Stat icon={UserCheck} value={currency.format(overview.value.active_students)} label="طلاب نشطون" tone="success" />
            <Stat icon={UserPlus} value={currency.format(overview.value.new_students_30d)} label="طلاب جدد (30 يوم)" tone="teal" />
            <Stat icon={ClipboardCheck} value={currency.format(overview.value.total_enrollments)} label="إجمالي التسجيلات" />
            <Stat icon={Wallet} value={`${currency.format(overview.value.revenue_total)} دج`} label="إجمالي الإيرادات" tone="gold" />
            <Stat icon={TrendingUp} value={`${currency.format(overview.value.revenue_30d)} دج`} label="إيرادات (30 يوم)" tone="gold" />
            <Stat icon={Star} value={overview.value.avg_rating.toFixed(1)} label="متوسط التقييم" tone="gold" />
            <Stat icon={Clock} value={formatHoursMinutes(overview.value.total_watch_seconds)} label="إجمالي وقت المشاهدة" tone="teal" />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px]">معدّل إكمال الدورات</h3>
              <span className="num text-[20px] font-bold text-primary">{overview.value.completion_rate_pct}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border-light">
              <div
                className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover"
                style={{ width: `${overview.value.completion_rate_pct}%` }}
              />
            </div>
          </Card>

          <Card padded={false}>
            <div className="border-b border-border-light p-lg pb-4">
              <h3 className="text-[15px]">الدورات الأكثر إقبالاً</h3>
            </div>
            {!popularCourses?.value.length ? (
              <p className="p-lg text-[13.5px] text-text-muted-light">لا توجد بيانات بعد</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr>
                    <th className="border-b border-border-light px-4 py-3 text-start text-[12.5px] font-semibold text-text-muted-light">الدورة</th>
                    <th className="border-b border-border-light px-4 py-3 text-start text-[12.5px] font-semibold text-text-muted-light">الطلاب</th>
                    <th className="border-b border-border-light px-4 py-3 text-start text-[12.5px] font-semibold text-text-muted-light">التقييم</th>
                    <th className="border-b border-border-light px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {popularCourses.value.map((c) => (
                    <tr key={c.course_id} className="hover:bg-bg-light">
                      <td className="border-b border-border-light px-4 py-3">{c.title}</td>
                      <td className="num border-b border-border-light px-4 py-3">{c.students_count}</td>
                      <td className="num border-b border-border-light px-4 py-3">★ {c.rating.toFixed(1)}</td>
                      <td className="border-b border-border-light px-4 py-3 text-end">
                        <Link href={`/admin/courses/${c.course_id}/analytics`} className="text-primary hover:underline">
                          التحليلات ←
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  tone = "violet",
}: {
  icon: typeof Users;
  value: string;
  label: string;
  tone?: "violet" | "success" | "gold" | "teal";
}) {
  const toneClasses: Record<string, string> = {
    violet: "bg-primary/10 text-primary",
    success: "bg-success/15 text-[#1e8a56]",
    gold: "bg-gold/15 text-[#96721f]",
    teal: "bg-secondary/15 text-[#0f9c86]",
  };

  return (
    <Card className="flex items-center gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${toneClasses[tone]}`}>
        <Icon size={19} strokeWidth={1.6} />
      </div>
      <div>
        <div className="num text-[18px] font-bold leading-tight">{value}</div>
        <div className="text-[11.5px] text-text-muted-light">{label}</div>
      </div>
    </Card>
  );
}
