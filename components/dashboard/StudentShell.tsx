import { redirect } from "next/navigation";
import { getSessionUser, getSessionProfile } from "@/lib/auth/session";
import { StudentSidebar } from "@/components/dashboard/StudentSidebar";
import { StudentTopbar } from "@/components/dashboard/StudentTopbar";
import { StudyTimerProvider } from "@/components/dashboard/StudyTimerProvider";
import { FloatingStudyTimer } from "@/components/dashboard/FloatingStudyTimer";
import { FocusProvider } from "@/components/dashboard/FocusMode";
import { MobileTabBar } from "@/components/dashboard/MobileTabBar";
import { getAllProgress, computeStats, getUnreadNotificationCount, getRecentNotifications } from "@/lib/data/student-dashboard";
import { getDictionary } from "@/lib/i18n/locale";
import { studentUnreadMessages } from "@/lib/data/teacher-inbox";

/**
 * The signed-in student's chrome — sidebar, topbar, study timer, phone
 * tab bar — extracted from app/dashboard/layout.tsx so it can wrap more
 * than /dashboard.
 *
 * It had to move because the marketing navbar is no longer rendered for
 * a signed-in student ANYWHERE (see app/layout.tsx). Without that bar,
 * a student who opened a course, an article or the contact page had no
 * navigation at all and no way back except the browser's own history.
 * This shell is what replaces it: the same rail they know, on every
 * page they can reach.
 *
 * It reads the same real data the dashboard rail always did — the
 * progress card and the notification badge are not decorative numbers —
 * which is why it is a server component and why the pages that use it
 * pay one extra round trip. Three small indexed reads, issued together.
 *
 * MaybeStudentShell below is the form every non-dashboard section uses:
 * guests and teachers/admins must keep the public layout, because
 * /courses is still the shareable, indexable catalogue for people who
 * have not signed in.
 */
export async function StudentShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  /* Shared with the page and anything else in this render — see
     getSessionProfile in lib/auth/session.ts. */
  const profile = await getSessionProfile();

  /*
    A student with no academic year cannot be shown a useful platform:
    the library is scoped by year and would look almost empty, and the
    study garden would have no cohort. Registration always demanded the
    year; Google sign-in never asked for it. One question, asked once —
    see app/(auth)/choose-year.

    Students only. A teacher or admin has no year and needs none.
  */
  if (profile && profile.role === "student" && profile.academic_year_id === null) {
    redirect("/choose-year");
  }

  const [progress, unreadCount, unreadMessages, recentNotifications] = await Promise.all([
    getAllProgress(user!.id),
    getUnreadNotificationCount(user!.id),
    studentUnreadMessages(user!.id),
    getRecentNotifications(user!.id),
  ]);
  const stats = computeStats(progress);
  const { dict } = await getDictionary();
  const t = dict.dash;

  const name = profile?.full_name?.trim() || t.roles.student;
  const roleLabel =
    profile?.role === "admin"
      ? t.roles.admin
      : profile?.role === "teacher"
        ? t.roles.teacher
        : t.roles.studentLong;

  return (
    <StudyTimerProvider>
      <FocusProvider>
      <div className="flex min-h-screen bg-academy-lavender">
        <StudentSidebar
          name={name}
          unreadMessages={unreadMessages}
          unreadCount={unreadCount}
          overallProgressPct={stats.averageProgressPct}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <StudentTopbar
            name={name}
            bellItems={recentNotifications.map((n) => ({
              id: n.id,
              title: n.title,
              body: n.body,
              created_at: n.created_at,
              is_read: n.is_read,
              /* Same destinations the full list uses. */
              href:
                n.related_entity_type === "thread" && n.related_entity_id
                  ? `/dashboard/messages`
                  : n.related_entity_type === "course" && n.related_entity_id
                    ? `/courses/${n.related_entity_id}`
                    : null,
            }))}
            role={roleLabel}
            unreadCount={unreadCount}
            avatarUrl={profile?.avatar_url ?? null}
          />
          {/*
            The padding clears the fixed tab bar. Without it the last
            card on every page sits underneath the bar and cannot be
            reached — the bar is out of flow, so nothing reserves its
            height.
          */}
          <main className="min-w-0 flex-1 pb-[72px] lg:pb-0">{children}</main>
        </div>
      </div>
      <FloatingStudyTimer />
      </FocusProvider>
      <MobileTabBar />
    </StudyTimerProvider>
  );
}

/**
 * Wraps `children` in the student shell for a signed-in student, and
 * leaves them untouched for everybody else.
 *
 * Teachers and admins are deliberately excluded: they have their own
 * areas, and giving them a student rail on /courses would misrepresent
 * whose progress the card is showing.
 */
export async function MaybeStudentShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user?.role !== "student") return <>{children}</>;
  return <StudentShell>{children}</StudentShell>;
}

/**
 * The shell for ANY signed-in person, whatever their role.
 *
 * Used by the sections that are reached FROM the dashboard rather than
 * from the catalogue — articles and contact, which the rail links to
 * directly. Following a link in the sidebar and landing on a page with
 * no sidebar reads as being thrown out of the platform, and it did
 * exactly that for a teacher or an admin: MaybeStudentShell keeps only
 * students inside, so everyone else fell through to the marketing
 * layout mid-session.
 *
 * /courses and /packs deliberately keep MaybeStudentShell — those stay
 * the shareable, indexable catalogue, and a rail claiming someone
 * else's progress would misrepresent it.
 *
 * A signed-out visitor still gets the public page, which is the point
 * of these routes being public at all.
 */
export async function SignedInShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return <>{children}</>;
  return <StudentShell>{children}</StudentShell>;
}
