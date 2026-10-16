/**
 * Rate-limit and input rules for the AI study assistant.
 *
 * Pure and dependency-free so the limits can be unit-tested without a
 * database or an API key (tests/ai-assistant.test.ts) — the same
 * lib/study/* split used elsewhere in this project.
 */

/**
 * No per-student daily cap.
 *
 * The assistant runs on Gemini's free tier, which enforces its own
 * quota at the provider — a second limit here would only stop a student
 * mid-revision for no benefit to anyone. Usage is still COUNTED (see
 * ai_chat_usage, migration 0037) so runaway use stays visible; it is
 * simply not blocked.
 *
 * Reinstate a number here if the platform ever moves to a paid tier —
 * `checkQuestion` already threads it through.
 */
export const DAILY_MESSAGE_LIMIT = Infinity;

/** Longest single question accepted. Long enough to paste a case
 *  vignette, short enough that one request cannot become a whole
 *  textbook of billable input. */
export const MAX_QUESTION_CHARS = 2000;

/** Turns of history replayed to the model. The API is stateless, so the
 *  whole window is re-sent — and therefore re-billed — on every turn.
 *  Six keeps a coherent thread without the cost growing without bound
 *  as a conversation runs on. */
export const HISTORY_TURNS = 6;

export type LimitCheck =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: "daily_limit" | "empty" | "too_long"; message: string };

export function checkQuestion(question: string, usedToday: number): LimitCheck {
  const trimmed = question.trim();

  if (!trimmed) {
    return { allowed: false, reason: "empty", message: "اكتب سؤالك أولاً." };
  }

  if (trimmed.length > MAX_QUESTION_CHARS) {
    return {
      allowed: false,
      reason: "too_long",
      message: `السؤال طويل جداً (${trimmed.length} حرفاً). الحد الأقصى ${MAX_QUESTION_CHARS} حرف.`,
    };
  }

  // `>=` not `>`: a student who has already used the whole allowance is
  // at the limit, not one question below it. With no cap configured
  // this branch never fires.
  if (usedToday >= DAILY_MESSAGE_LIMIT) {
    return {
      allowed: false,
      reason: "daily_limit",
      message: `استهلكت أسئلتك اليومية (${DAILY_MESSAGE_LIMIT}). ستتجدد غداً.`,
    };
  }

  return { allowed: true, remaining: DAILY_MESSAGE_LIMIT - usedToday - 1 };
}

/** Keeps the last N turns. Trimming from the START preserves the most
 *  recent exchange, which is what the next answer depends on. */
export function trimHistory<T>(history: T[], turns = HISTORY_TURNS): T[] {
  const max = turns * 2; // a turn is one question + one answer
  return history.length <= max ? history : history.slice(-max);
}
