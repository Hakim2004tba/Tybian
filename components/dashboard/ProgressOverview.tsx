import { getSessionUser } from "@/lib/auth/session";
import { getAllProgress, computeStats } from "@/lib/data/student-dashboard";
import { getWeeklyStudySeconds } from "@/lib/data/study-tools";
import { query } from "@/lib/db";
import { formatHoursMinutes } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "تقدّمي" — a donut for the overall figure plus a per-course breakdown.
 *
 * The donut is a plain SVG with a stroke-dasharray arc: no chart
 * library, no client JS, and it renders identically in the server HTML
 * (DESIGN_SYSTEM.md §15). Course titles are resolved in ONE query for
 * the ids already in hand rather than per row.
 */
export async function ProgressOverview() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const [progress, weeklySeconds] = await Promise.all([
    getAllProgress(user!.id),
    getWeeklyStudySeconds(user!.id),
  ]);
  const stats = computeStats(progress);

  const completed = stats.coursesCompleted;
  const inProgress = progress.filter(
    (p) => p.total_lessons > 0 && p.completed_lessons > 0 && p.completed_lessons < p.total_lessons
  ).length;
  const notStarted = progress.filter((p) => p.completed_lessons === 0).length;

  // Resolve titles for the breakdown bars in a single query.
  const ids = progress.map((p) => p.course_id);
  let titles = new Map<string, string>();
  if (ids.length > 0) {
    // One placeholder per id — an IN list cannot be a single bound
    // parameter, and interpolating the ids would unparameterise it.
    const rows = await query<{ id: string; title: string }>(
      `SELECT id, title FROM courses WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    titles = new Map(rows.map((c) => [c.id, c.title]));
  }

  const bars = progress
    .filter((p) => p.total_lessons > 0)
    .map((p) => ({
      title: titles.get(p.course_id) ?? dict.dash.common.course,
      pct: Math.round((p.completed_lessons / p.total_lessons) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (stats.averageProgressPct / 100) * C;

  return (
    <section id="progress" className="rounded-xl border border-white/70 bg-white p-lg shadow-sm">
      <h2 className="text-[16px] font-semibold text-text-primary-light">{t.progress.overall}</h2>

      {progress.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-text-muted-light">
          {t.progress.empty}
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative shrink-0">
              <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                <circle cx="64" cy="64" r={R} fill="none" stroke="#E7E5EB" strokeWidth="12" />
                <circle
                  cx="64"
                  cy="64"
                  r={R}
                  fill="none"
                  stroke="#6C4CF1"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${C - dash}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="num text-[22px] font-bold leading-none text-text-primary-light">
                  {stats.averageProgressPct}%
                </span>
                <span className="mt-1 text-[11px] text-text-muted-light">{t.common.completed}</span>
              </div>
            </div>

            <ul className="flex-1 space-y-2.5 text-[13px]">
              <LegendRow color="bg-success" label={t.common.completedCourses} value={completed} />
              <LegendRow color="bg-primary" label={t.common.inProgress} value={inProgress} />
              <LegendRow color="bg-academy-lavender-deep" label={t.common.notStarted} value={notStarted} />
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-md bg-academy-lavender-soft px-3.5 py-2.5">
            <span className="text-[12.5px] text-text-secondary-light">{t.progress.weekStudyTime}</span>
            <span className="num text-[14px] font-semibold text-text-primary-light">
              {formatHoursMinutes(weeklySeconds)}
            </span>
          </div>

          {bars.length > 0 && (
            <div className="mt-5 space-y-3.5">
              {bars.map((b) => (
                <div key={b.title}>
                  <div className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="truncate text-text-secondary-light">{b.title}</span>
                    <span className="num shrink-0 font-semibold text-text-primary-light">{b.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-academy-lavender">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-primary to-secondary"
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />
      <span className="flex-1 text-text-secondary-light">{label}</span>
      <span className="num font-semibold text-text-primary-light">{value}</span>
    </li>
  );
}
