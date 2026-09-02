import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aggregateLeaderboard, type StudySessionRow } from "@/lib/study/leaderboard";

// ---------------------------------------------------------------------
// Spaced repetition — due reviews
// ---------------------------------------------------------------------
export type DueReview = {
  reviewId: string;
  lessonId: string;
  lessonTitle: string;
  courseSlug: string;
  courseTitle: string;
  repetitions: number;
};

export async function getDueReviews(userId: string, limit = 10): Promise<DueReview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_reviews")
    .select(
      "id, lesson_id, repetitions, lessons ( title, course_sections ( courses ( slug, title ) ) )"
    )
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(limit);

  return (data ?? [])
    .map((r) => {
      const lessonRaw = (Array.isArray(r.lessons) ? r.lessons[0] : r.lessons) as unknown as
        | { title: string; course_sections: unknown }
        | null;
      const sectionRaw = lessonRaw
        ? ((Array.isArray(lessonRaw.course_sections) ? lessonRaw.course_sections[0] : lessonRaw.course_sections) as unknown as
            | { courses: unknown }
            | null)
        : null;
      const courseRaw = sectionRaw
        ? ((Array.isArray(sectionRaw.courses) ? sectionRaw.courses[0] : sectionRaw.courses) as unknown as
            | { slug: string; title: string }
            | null)
        : null;

      if (!lessonRaw || !courseRaw) return null;

      return {
        reviewId: r.id,
        lessonId: r.lesson_id,
        lessonTitle: lessonRaw.title,
        courseSlug: courseRaw.slug,
        courseTitle: courseRaw.title,
        repetitions: r.repetitions,
      };
    })
    .filter((x): x is DueReview => x !== null);
}

export async function getDueReviewCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("lesson_reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString());
  return count ?? 0;
}

// ---------------------------------------------------------------------
// Study timer
// ---------------------------------------------------------------------
export async function getWeeklyStudySeconds(userId: string): Promise<number> {
  const supabase = await createClient();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("study_sessions")
    .select("duration_seconds")
    .eq("user_id", userId)
    .gte("created_at", weekStart.toISOString());

  return (data ?? []).reduce((sum, r) => sum + r.duration_seconds, 0);
}

// ---------------------------------------------------------------------
// Leaderboard — same academic year, last 60 days (bounded window),
// aggregated in TS via aggregateLeaderboard (see lib/study/leaderboard.ts
// for why this isn't done via SQL date-math).
// ---------------------------------------------------------------------
export type LeaderboardRow = {
  userId: string;
  fullName: string;
  weeklySeconds: number;
  streakDays: number;
  isCurrentUser: boolean;
};

export async function getStudyLeaderboard(userId: string, limit = 10): Promise<LeaderboardRow[]> {
  const supabase = await createClient();

  const { data: me } = await supabase.from("profiles").select("academic_year_id").eq("id", userId).maybeSingle();
  if (!me?.academic_year_id) return [];

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 60);

  // RLS (study_sessions_same_year_select, 0029) already scopes this to
  // students sharing the caller's own academic year — no explicit join
  // filter needed here, the database enforces it regardless.
  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("user_id, duration_seconds, created_at")
    .gte("created_at", windowStart.toISOString());

  if (!sessions?.length) return [];

  const rows: StudySessionRow[] = sessions.map((s) => ({
    userId: s.user_id,
    durationSeconds: s.duration_seconds,
    date: s.created_at.slice(0, 10),
  }));

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const aggregated = aggregateLeaderboard(rows, weekStartStr, today).slice(0, limit);

  const userIds = aggregated.map((a) => a.userId);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return aggregated.map((a) => ({
    userId: a.userId,
    fullName: nameById.get(a.userId) ?? "طالب",
    weeklySeconds: a.weeklySeconds,
    streakDays: a.streakDays,
    isCurrentUser: a.userId === userId,
  }));
}
