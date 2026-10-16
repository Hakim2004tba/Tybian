import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Users, Wallet, TrendingUp, Star, Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { queryOne } from "@/lib/db";
import { getCourseOverview, getCourseLessonEngagement } from "@/lib/analytics/queries";
import { refreshCourseAnalyticsAction } from "@/lib/admin/actions/analytics";
import { RefreshAnalyticsButton } from "@/components/admin/analytics/RefreshAnalyticsButton";

const currency = new Intl.NumberFormat("en-US");

function formatMinutes(seconds: number) {
  const m = Math.round(seconds / 60);
  return `${m} د`;
}

export default async function CourseAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await queryOne<{ id: string; title: string }>(
    `SELECT id, title FROM courses WHERE id = ?`,
    [id]
  );
  if (!course) notFound();

  const [overview, engagement] = await Promise.all([getCourseOverview(id), getCourseLessonEngagement(id)]);

  const refreshAction = refreshCourseAnalyticsAction.bind(null, id);

  const mostWatched = engagement?.value ? [...engagement.value].sort((a, b) => b.engaged_count - a.engaged_count).slice(0, 5) : [];
  const highDropout = engagement?.value ? [...engagement.value].filter((l) => l.dropout_pct > 0).sort((a, b) => b.dropout_pct - a.dropout_pct).slice(0, 5) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/courses/${id}`} className="flex w-fit items-center gap-1.5 text-[13.5px] text-text-muted-light hover:text-primary">
          <ArrowRight size={14} />
          العودة إلى تفاصيل الدورة
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="violet">تحليلات الدورة</Badge>
            <h1 className="mt-3 text-2xl">{course.title}</h1>
          </div>
          <RefreshAnalyticsButton action={refreshAction} computedAt={overview?.computedAt ?? null} />
        </div>
      </div>

      {!overview ? (
        <Card>
          <p className="text-[14px] text-text-secondary-light">
            لم تُحسب تحليلات هذه الدورة بعد — اضغط &quot;تحديث الآن&quot;.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Stat icon={Users} value={String(overview.value.students_count)} label="الطلاب" />
            <Stat icon={Wallet} value={`${currency.format(overview.value.revenue_total)} دج`} label="الإيرادات" tone="gold" />
            <Stat icon={TrendingUp} value={`${overview.value.completion_rate_pct}%`} label="معدّل الإكمال" tone="success" />
            <Stat icon={TrendingUp} value={`${overview.value.avg_progress_pct}%`} label="متوسط التقدم" tone="teal" />
            <Stat icon={Star} value={overview.value.avg_rating.toFixed(1)} label="التقييم" tone="gold" />
            <Stat icon={Clock} value={formatMinutes(overview.value.total_watch_seconds)} label="وقت المشاهدة" tone="teal" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card padded={false}>
              <div className="border-b border-border-light p-lg pb-4">
                <h3 className="text-[15px]">الدروس الأكثر مشاهدة</h3>
              </div>
              {mostWatched.length === 0 ? (
                <p className="p-lg text-[13.5px] text-text-muted-light">لا توجد بيانات بعد</p>
              ) : (
                <div className="flex flex-col divide-y divide-border-light">
                  {mostWatched.map((l, i) => (
                    <div key={l.lesson_id} className="flex items-center gap-3 p-lg py-3">
                      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{l.title}</span>
                      <span className="num shrink-0 text-[12px] text-text-muted-light">{l.engaged_count} طالب</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padded={false}>
              <div className="border-b border-border-light p-lg pb-4">
                <h3 className="flex items-center gap-2 text-[15px]">
                  <AlertTriangle size={15} className="text-error" />
                  دروس بمعدل تسرّب مرتفع
                </h3>
              </div>
              {highDropout.length === 0 ? (
                <p className="p-lg text-[13.5px] text-text-muted-light">لا يوجد تسرّب ملحوظ</p>
              ) : (
                <div className="flex flex-col divide-y divide-border-light">
                  {highDropout.map((l) => (
                    <div key={l.lesson_id} className="p-lg py-3">
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                        <span className="num shrink-0 font-semibold text-error">{l.dropout_pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border-light">
                        <div className="h-full rounded-full bg-error" style={{ width: `${l.dropout_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
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
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClasses[tone]}`}>
        <Icon size={17} strokeWidth={1.6} />
      </div>
      <div>
        <div className="num text-[16px] font-bold leading-tight">{value}</div>
        <div className="text-[11px] text-text-muted-light">{label}</div>
      </div>
    </Card>
  );
}
