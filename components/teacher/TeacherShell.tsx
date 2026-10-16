import { getSessionProfile } from "@/lib/auth/session";
import { StudentSidebar } from "@/components/dashboard/StudentSidebar";
import { StudentTopbar } from "@/components/dashboard/StudentTopbar";
import { TeacherTabBar } from "@/components/teacher/TeacherTabBar";
import { teacherNav } from "@/config/teacher-navigation";
import { getTeacherScope, getStats } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The teacher space, wearing the student shell.
 *
 * Same rail, same topbar, same phone tab bar — the request was for the
 * teacher page to look exactly like the student one, and the way to
 * honour that is to render the SAME components rather than a careful
 * imitation of them. StudentSidebar and StudentTopbar take their
 * navigation and labels as props for this reason; nothing about the
 * student view changed.
 *
 * What differs is only what belongs to a teacher: their own seven
 * destinations, and a rail card showing their students and unanswered
 * questions instead of a study-progress bar. There is no study timer
 * here — a teacher is not revising.
 */
export async function TeacherShell({ children }: { children: React.ReactNode }) {
  const [profile, { dict }, scope] = await Promise.all([
    getSessionProfile(),
    getDictionary(),
    getTeacherScope(),
  ]);

  const t = dict.teacher;
  const stats = scope ? await getStats(scope) : null;

  const name = profile?.full_name?.trim() || t.space;
  const roleLabel = profile?.role === "admin" ? dict.dash.roles.admin : dict.dash.roles.teacher;

  /* key → label, in the reader's language, for both the rail and the
     phone drawer. */
  const labels = Object.fromEntries(
    teacherNav.map((item) => [item.key, (t.nav as Record<string, string>)[item.key] ?? item.key])
  );

  return (
    <div className="flex min-h-screen bg-academy-lavender">
      <StudentSidebar
        name={name}
        overallProgressPct={0}
        items={teacherNav}
        labels={labels}
        settingsHref="/teacher"
        footerCard={
          stats && (
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div
                className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/25 blur-2xl"
                aria-hidden="true"
              />
              <p className="relative text-[12.5px] leading-relaxed text-white/70">
                {t.space}
                <span className="block font-semibold text-white">{t.subtitle}</span>
              </p>
              <div className="relative mt-3 flex items-center justify-between text-[11.5px] text-white/60">
                <span>{t.stats.students}</span>
                <span className="num font-semibold text-white">{stats.students}</span>
              </div>
              <div className="relative mt-1.5 flex items-center justify-between text-[11.5px] text-white/60">
                <span>{t.stats.openQuestions}</span>
                <span className="num font-semibold text-white">{stats.openQuestions}</span>
              </div>
            </div>
          )
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <StudentTopbar
          name={name}
          role={roleLabel}
          avatarUrl={profile?.avatar_url ?? null}
          variant="teacher"
          searchAction="/teacher/courses"
          notificationsHref="/teacher/questions"
        />
        {/* Clears the fixed phone tab bar, which is out of flow and so
            reserves no height of its own. */}
        <main className="min-w-0 flex-1 pb-[72px] lg:pb-0">{children}</main>
      </div>

      <TeacherTabBar />
    </div>
  );
}
