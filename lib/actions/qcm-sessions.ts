"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { sampleQuestionIds } from "@/lib/data/qcm-bank";
import { sessionsReady } from "@/lib/data/qcm-sessions";

export type CreateResult =
  | { ok: true; id: string; total: number }
  | { ok: false; error: "unauthenticated" | "unavailable" | "no_topics" | "empty" };

/**
 * Starts a session over the chosen topics.
 *
 * The question set is resolved and STORED here, not recomputed on each
 * open — see the migration note. Everything about the set is decided
 * once, at this moment, and never moves again.
 */
export async function createSessionAction(input: {
  title: string;
  topicIds: string[];
  count: number;
  mode: "instant" | "exam";
  ordering: "topic" | "random";
}): Promise<CreateResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  if (!(await sessionsReady())) return { ok: false, error: "unavailable" };

  const topicIds = [...new Set(input.topicIds)].filter(Boolean).slice(0, 60);
  if (topicIds.length === 0) return { ok: false, error: "no_topics" };

  const ordering = input.ordering === "topic" ? "topic" : "random";
  const count = Number.isFinite(input.count) ? Math.max(0, Math.min(500, Math.trunc(input.count))) : 0;

  const ids = await sampleQuestionIds(topicIds, count, ordering);
  if (ids.length === 0) return { ok: false, error: "empty" };

  const title = (input.title || "").trim().slice(0, 200) ||
    (topicIds.length === 1 ? "جلسة" : `تجميعة (${topicIds.length})`);

  const id = newId();
  await execute(
    `INSERT INTO qcm_sessions
       (id, user_id, title, mode, ordering, question_ids, total, cursor_at, topic_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      user.id,
      title,
      input.mode === "exam" ? "exam" : "instant",
      ordering,
      JSON.stringify(ids),
      ids.length,
      JSON.stringify(topicIds),
    ]
  );

  revalidatePath("/dashboard/qcm");
  return { ok: true, id, total: ids.length };
}

/**
 * Records one answer and moves the bookmark.
 *
 * `is_correct` is recomputed in SQL from the stored options rather than
 * trusted from the browser — the answers travel to the client so the
 * correction can be instant, which also means a client could claim to
 * have got everything right.
 *
 * ON DUPLICATE-style replace: answering the same question twice in one
 * session overwrites rather than stacking, so the counts stay honest.
 */
export async function saveAnswerAction(
  sessionId: string,
  questionId: string,
  chosen: string[],
  seconds: number,
  cursorAt: number
): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (!(await sessionsReady())) return;

  try {
    const owns = await queryOne<{ id: string }>(
      `SELECT id FROM qcm_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
      [sessionId, user.id]
    );
    if (!owns) return;

    const payload = JSON.stringify(chosen);

    await execute(`DELETE FROM qcm_answers WHERE session_id = ? AND question_id = ?`, [
      sessionId,
      questionId,
    ]);

    await execute(
      `INSERT INTO qcm_answers (id, user_id, session_id, question_id, chosen, seconds, is_correct)
       SELECT ?, ?, ?, ?, ?, ?,
              CASE WHEN (
                SELECT COUNT(*) FROM qcm_options o
                 WHERE o.question_id = ?
                   AND ((o.is_correct = 1 AND NOT JSON_CONTAINS(?, JSON_QUOTE(o.letter)))
                     OR (o.is_correct = 0 AND JSON_CONTAINS(?, JSON_QUOTE(o.letter))))
              ) = 0 THEN 1 ELSE 0 END`,
      [newId(), user.id, sessionId, questionId, payload, Math.max(0, Math.trunc(seconds)),
       questionId, payload, payload]
    );

    await execute(
      `UPDATE qcm_sessions SET cursor_at = GREATEST(cursor_at, ?) WHERE id = ? AND user_id = ?`,
      [Math.max(0, Math.trunc(cursorAt)), sessionId, user.id]
    );
  } catch {
    /* A lost history row must never break the session in progress. */
  }
}

export async function finishSessionAction(sessionId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (!(await sessionsReady())) return;
  try {
    await execute(
      `UPDATE qcm_sessions SET finished_at = NOW(3) WHERE id = ? AND user_id = ? AND finished_at IS NULL`,
      [sessionId, user.id]
    );
    revalidatePath("/dashboard/qcm");
  } catch {
    /* ignored */
  }
}

/** Reopens a finished session and clears its answers. */
export async function restartSessionAction(sessionId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (!(await sessionsReady())) return;
  try {
    const owns = await queryOne<{ id: string }>(
      `SELECT id FROM qcm_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
      [sessionId, user.id]
    );
    if (!owns) return;
    await execute(`DELETE FROM qcm_answers WHERE session_id = ?`, [sessionId]);
    await execute(
      `UPDATE qcm_sessions SET cursor_at = 0, finished_at = NULL WHERE id = ?`,
      [sessionId]
    );
    revalidatePath("/dashboard/qcm");
  } catch {
    /* ignored */
  }
}

export async function deleteSessionAction(sessionId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (!(await sessionsReady())) return;
  try {
    await execute(`DELETE FROM qcm_answers WHERE session_id = ?`, [sessionId]);
    await execute(`DELETE FROM qcm_sessions WHERE id = ? AND user_id = ?`, [sessionId, user.id]);
    revalidatePath("/dashboard/qcm");
  } catch {
    /* ignored */
  }
}

export async function renameSessionAction(sessionId: string, title: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (!(await sessionsReady())) return;
  const clean = title.trim().slice(0, 200);
  if (!clean) return;
  try {
    await execute(`UPDATE qcm_sessions SET title = ? WHERE id = ? AND user_id = ?`, [
      clean,
      sessionId,
      user.id,
    ]);
    revalidatePath("/dashboard/qcm");
  } catch {
    /* ignored */
  }
}
