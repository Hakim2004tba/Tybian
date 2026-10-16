/**
 * The four things a student marks a page for.
 *
 * A bookmark that only says "page 12" is a bookmark they have to open
 * to understand. These say WHY in one tap, and `library_bookmarks`
 * already has the `label` column to hold it — no migration needed.
 *
 * Deliberately four and not more: a marker menu long enough to need
 * reading is slower than the scroll it replaced.
 */
export const MARKERS = [
  { key: "important", emoji: "🔖", ar: "مهم", en: "Important", tone: "text-primary" },
  { key: "exam", emoji: "⭐", ar: "امتحان", en: "Exam", tone: "text-gold" },
  { key: "hard", emoji: "⚠️", ar: "صعب", en: "Difficult", tone: "text-error" },
  { key: "review", emoji: "↻", ar: "للمراجعة", en: "Review later", tone: "text-secondary" },
] as const;

export type MarkerKey = (typeof MARKERS)[number]["key"];

export function markerFor(label: string | null) {
  return MARKERS.find((m) => m.key === label) ?? null;
}
