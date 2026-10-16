/**
 * Duration formatting, in one place.
 *
 * THE BUG THIS FIXES: the app wrote durations as `${hours}س ${minutes}د`.
 * In an RTL paragraph the bidirectional algorithm reorders that run, so
 * "8س 31د" renders as "س31د8" — the numbers and their units swap sides
 * and the value becomes unreadable. It was wrong in six separate copies
 * of the same helper.
 *
 * Two decisions follow from that:
 *
 *  1. Latin unit letters (h / min) rather than Arabic ones. A number
 *     followed by a Latin letter is a single left-to-right run, which
 *     the bidi algorithm keeps intact. It is also how every video
 *     platform this audience already uses writes durations.
 *
 *  2. Every returned string is wrapped in U+2066 / U+2069 — a Unicode
 *     "first-strong isolate". That tells the renderer to lay the run out
 *     on its own, so it cannot be reordered by whatever Arabic text
 *     surrounds it. The characters are invisible and cost nothing.
 *
 * Do not build duration strings anywhere else. If a new screen needs a
 * different shape, add a function here.
 */

/** Wraps a run so surrounding RTL text cannot reorder it. */
const ltr = (value: string) => `⁦${value}⁩`;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Study time and other "how long in total" figures.
 *
 *   8h 31min   ·   45min   ·   0min
 */
export function formatHoursMinutes(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return ltr(`${hours}h ${minutes}min`);
  return ltr(`${minutes}min`);
}

/**
 * The compact variant, for stat tiles where space is tight and the
 * minutes add nothing next to a large hour count.
 *
 *   8h   ·   45min
 */
export function formatHoursShort(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  if (hours > 0) return ltr(`${hours}h`);
  return ltr(`${Math.floor(safe / 60)}min`);
}

/**
 * A single lesson's length, in the course outline and the player.
 *
 *   00:52h   ·   01:05h
 *
 * Hours:minutes, not minutes:seconds. The old format wrote a 52-minute
 * lesson as "52:30", which reads as fifty-two HOURS at a glance — the
 * complaint that prompted this. Seconds are dropped deliberately: nobody
 * choosing what to watch next needs them.
 */
export function formatLessonLength(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  if (safe === 0) return "";

  const hours = Math.floor(safe / 3600);
  // Rounded, so a 51-minute-40-second lesson does not advertise 51.
  const minutes = Math.round((safe % 3600) / 60);

  // 60 after rounding would print "00:60h".
  if (minutes === 60) return ltr(`${pad(hours + 1)}:00h`);
  return ltr(`${pad(hours)}:${pad(minutes)}h`);
}

/** Same as above but never empty — for tables that need a placeholder. */
export function formatLessonLengthOrDash(seconds: number): string {
  return formatLessonLength(seconds) || "—";
}

/**
 * A course's total length, from its stored minutes rather than seconds.
 *
 *   14h 02min   ·   45min
 */
export function formatCourseMinutes(minutes: number): string {
  return formatHoursMinutes(Math.max(0, Math.floor(minutes || 0)) * 60);
}
