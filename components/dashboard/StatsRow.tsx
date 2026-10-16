import { BookOpen, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getAllProgress, computeStats } from "@/lib/data/student-dashboard";
import { getSessionUser } from "@/lib/auth/session";
import { formatHoursMinutes } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Its own Suspense boundary (see app/dashboard/page.tsx) — computed from
 * getAllProgress, which is bounded by this user's own enrollment count,
 * not "all data in the system". Runs in parallel with the paginated
 * course grid rather than blocking it.
 */
export async function StatsRow() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const progress = await getAllProgress(user!.id);
  const stats = computeStats(progress);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard icon={BookOpen} value={String(stats.coursesEnrolled)} label={t.stats.enrolled} />
      <StatCard icon={CheckCircle2} value={String(stats.coursesCompleted)} label={t.stats.completed} tone="success" />
      <StatCard icon={Clock} value={formatHoursMinutes(stats.totalWatchSeconds)} label={t.stats.watchTime} tone="gold" />
      <StatCard icon={TrendingUp} value={`${stats.averageProgressPct}%`} label={t.stats.avgProgress} tone="teal" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone = "violet",
}: {
  icon: typeof BookOpen;
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
        <Icon size={20} strokeWidth={1.6} />
      </div>
      <div>
        <div className="num text-[20px] font-bold leading-tight">{value}</div>
        <div className="text-[12px] text-text-muted-light">{label}</div>
      </div>
    </Card>
  );
}
