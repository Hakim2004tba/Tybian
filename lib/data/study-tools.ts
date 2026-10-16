import "server-only";
import { query, queryOne } from "@/lib/db";
import { aggregateLeaderboard, type StudySessionRow } from "@/lib/study/leaderboard";
import { monthStart } from "@/lib/study/garden";

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
  try {
    /*
      The three-level nested Supabase select becomes two joins, and the
      "is it due" comparison moves into SQL as UTC_TIMESTAMP(3).

      That matters more than it looks: the old code sent
      `new Date().toISOString()`, so due-ness was judged by the Node
      process's clock against timestamps written by the database's. Two
      machines, two clocks. Now both sides of the comparison come from
      the same one.

      Inner joins throughout: a review whose lesson or course has been
      deleted has nowhere to send the student, and the old code filtered
      those out afterwards — which meant asking for 10 and sometimes
      showing 6. Requiring them in the join means LIMIT counts only rows
      that will render.
    */
    return await query<{
      reviewId: string;
      lessonId: string;
      lessonTitle: string;
      courseSlug: string;
      courseTitle: string;
      repetitions: number;
    }>(
      `SELECT lr.id         AS reviewId,
              lr.lesson_id  AS lessonId,
              l.title       AS lessonTitle,
              c.slug        AS courseSlug,
              c.title       AS courseTitle,
              lr.repetitions
         FROM lesson_reviews lr
         JOIN lessons l         ON l.id = lr.lesson_id AND l.deleted_at IS NULL
         JOIN course_sections s ON s.id = l.section_id AND s.deleted_at IS NULL
         JOIN courses c         ON c.id = s.course_id  AND c.deleted_at IS NULL
        WHERE lr.user_id = ?
          AND lr.next_review_at <= UTC_TIMESTAMP(3)
        ORDER BY lr.next_review_at ASC
        LIMIT ?`,
      [userId, limit]
    );
  } catch {
    return [];
  }
}

export async function getDueReviewCount(userId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM lesson_reviews
      WHERE user_id = ? AND next_review_at <= UTC_TIMESTAMP(3)`,
    [userId]
  );
  return Number(row?.n ?? 0);
}

// ---------------------------------------------------------------------
// Study timer
// ---------------------------------------------------------------------
export async function getWeeklyStudySeconds(userId: string): Promise<number> {
  // SUM in SQL rather than fetching every session row to add up in JS.
  const row = await queryOne<{ total: string | null }>(
    `SELECT SUM(duration_seconds) AS total
       FROM study_sessions
      WHERE user_id = ?
        AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)`,
    [userId]
  );
  return Number(row?.total ?? 0);
}

// ---------------------------------------------------------------------
// Leaderboard — same academic year, last 60 days (bounded window),
// aggregated in TS via aggregateLeaderboard (see lib/study/leaderboard.ts
// for why the streak maths is not SQL date arithmetic).
// ---------------------------------------------------------------------
export type LeaderboardRow = {
  userId: string;
  fullName: string;
  /** Profile picture, or null — the row falls back to an initial. */
  avatarUrl: string | null;
  weeklySeconds: number;
  /** This calendar month — what the garden and the ranking use. */
  monthlySeconds: number;
  streakDays: number;
  isCurrentUser: boolean;
};

export async function getStudyLeaderboard(userId: string, limit = 10): Promise<LeaderboardRow[]> {
  try {
    const me = await queryOne<{ academic_year_id: string | null }>(
      `SELECT academic_year_id FROM profiles WHERE id = ?`,
      [userId]
    );
    if (!me?.academic_year_id) return [];

    /*
      THE join this file used to get from RLS, and the most consequential
      one in the port.

      study_sessions_same_year_select (0029) scoped this to students
      sharing the caller's academic year, and the old code said so
      explicitly: "no explicit join filter needed here, the database
      enforces it regardless". The database enforces nothing now. Without
      the join to profiles and the year comparison below, this query
      returns every study session on the platform, and a first-year
      student's leaderboard silently fills with seventh-years — along
      with their names, further down this function.

      Names are fetched in the same query rather than in a second `in
      (...)` lookup afterwards, so there is exactly one place where a
      row's visibility is decided instead of two that must agree.
    */
    const sessions = await query<{
      user_id: string;
      full_name: string;
      avatar_url: string | null;
      duration_seconds: number;
      day: string;
    }>(
      `SELECT ss.user_id, p.full_name, p.avatar_url, ss.duration_seconds,
              DATE(ss.created_at) AS day
         FROM study_sessions ss
         JOIN profiles p ON p.id = ss.user_id
        WHERE p.academic_year_id = ?
          AND p.deleted_at IS NULL
          AND ss.created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 60 DAY)`,
      [me.academic_year_id]
    );

    if (!sessions.length) return [];

    const rows: StudySessionRow[] = sessions.map((s) => ({
      userId: s.user_id,
      durationSeconds: s.duration_seconds,
      // DATE() already yields 'YYYY-MM-DD', and dateStrings keeps it a
      // string, so there is no Date round trip to shift it a day.
      date: String(s.day),
    }));

    const nameById = new Map(sessions.map((s) => [s.user_id, s.full_name]));
    /*
      Selected in the same query as the name, for the same reason: one
      place decides whether a row is visible, so a face can never appear
      for a student the year filter excluded.
    */
    const avatarById = new Map(sessions.map((s) => [s.user_id, s.avatar_url]));

    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    return aggregateLeaderboard(rows, weekStartStr, today, monthStart(today))
      .slice(0, limit)
      .map((a) => ({
        userId: a.userId,
        fullName: nameById.get(a.userId) ?? "طالب",
        avatarUrl: avatarById.get(a.userId) ?? null,
        weeklySeconds: a.weeklySeconds,
        monthlySeconds: a.monthlySeconds,
        streakDays: a.streakDays,
        isCurrentUser: a.userId === userId,
      }));
  } catch {
    return [];
  }
}
