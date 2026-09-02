/**
 * Pure constant — deliberately kept in its own module without the
 * `server-only` guard (unlike lib/data/course-reviews.ts) so client
 * components like ReviewForm.tsx can import it directly without pulling
 * in server-only data-fetching code.
 */
export const REVIEW_REACTION_EMOJI: Record<string, string> = {
  loved: "😍",
  fire: "🔥",
  like: "👍",
  thinking: "🤔",
  sad: "😕",
};
