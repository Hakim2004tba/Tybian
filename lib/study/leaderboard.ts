/**
 * Pure aggregation over a bounded window of study_sessions rows —
 * kept out of SQL (which gets fiddly fast for "current streak,
 * allowing today to still be pending") and out of a live component,
 * so it's directly unit-testable. Dates are plain 'YYYY-MM-DD' strings
 * in the caller's local sense — the DB layer converts timestamps to
 * dates before calling this.
 */

export type StudySessionRow = {
  userId: string;
  durationSeconds: number;
  date: string; // 'YYYY-MM-DD'
};

export type LeaderboardEntry = {
  userId: string;
  weeklySeconds: number;
  streakDays: number;
};

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak = consecutive days with at least one session, counting
 * backward from today. If the student hasn't studied YET today, that's
 * not a broken streak — counting starts from yesterday instead, so a
 * student checking their streak at 9am doesn't see it reset to 0 before
 * they've had a chance to study.
 */
export function computeStreakDays(distinctDates: string[], today: string): number {
  const set = new Set(distinctDates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;

  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * Groups a flat list of sessions by user, computing weekly total
 * seconds (only sessions within `weekStartDate..today` inclusive) and
 * the streak (over the FULL provided window, which should be wider
 * than one week — the caller fetches ~60 days for this reason).
 */
export function aggregateLeaderboard(
  sessions: StudySessionRow[],
  weekStartDate: string,
  today: string
): LeaderboardEntry[] {
  const byUser = new Map<string, StudySessionRow[]>();
  for (const s of sessions) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const entries: LeaderboardEntry[] = [];
  for (const [userId, rows] of byUser) {
    const weeklySeconds = rows
      .filter((r) => r.date >= weekStartDate && r.date <= today)
      .reduce((sum, r) => sum + r.durationSeconds, 0);

    const distinctDates = [...new Set(rows.map((r) => r.date))];
    const streakDays = computeStreakDays(distinctDates, today);

    entries.push({ userId, weeklySeconds, streakDays });
  }

  return entries.sort((a, b) => b.weeklySeconds - a.weeklySeconds);
}
