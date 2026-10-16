import { getSessionUser } from "@/lib/auth/session";
import { getStudyLeaderboard } from "@/lib/data/study-tools";
import { StudyPlot, EmptyPlot } from "@/components/dashboard/StudyPlot";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The study competition — a plot of trees, then the month's ranking.
 *
 * Scope is enforced by the query, not by a filter here: getStudyLeaderboard
 * joins profiles and restricts rows to students sharing the caller's
 * academic year. Ranking is by study-TIMER minutes, not video watch time.
 *
 * WHAT CHANGED AND WHY: this used to be a single tree per student that
 * grew through five named stages each week, plus a shared cohort total.
 * Two problems. The stages were invisible progress — a student could
 * study for an hour and watch nothing happen, because the next stage was
 * an hour further on. And the weekly reset kept erasing the evidence of
 * a good fortnight. It is now twenty trees on the student's own ground,
 * one lit per two hours, over a calendar month; filling the ground
 * earns more ground. See lib/study/garden.ts.
 *
 * Everything displayed is real: minutes come from study_sessions.
 * Nothing is simulated.
 */
export async function StudyLeaderboard() {
  const user = await getSessionUser();
  const rows = await getStudyLeaderboard(user!.id);
  const { dict, locale } = await getDictionary();
  const labels = dict.dash.plot;

  if (rows.length === 0) return <EmptyPlot labels={labels} />;

  return <StudyPlot rows={rows} labels={labels} locale={locale} />;
}
