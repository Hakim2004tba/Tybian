"use server";

import { execute, newId } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { bankReady } from "@/lib/data/qcm-bank";

/**
 * Records one answer, for the student's own history.
 *
 * Fire-and-forget from the UI: the correction is already on screen by
 * the time this runs, so a slow write must never hold the next
 * question. It returns nothing for the same reason.
 *
 * `is_correct` is recomputed HERE from the database rather than
 * trusted from the browser — the answers travel to the client so the
 * correction is instant, which means a client could also claim to
 * have got everything right.
 */
export async function recordAnswerAction(
  questionId: string,
  chosen: string[]
): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (!(await bankReady())) return;

  try {
    await execute(
      `INSERT INTO qcm_answers (id, user_id, question_id, chosen, is_correct)
       SELECT ?, ?, ?, ?,
              CASE WHEN (
                SELECT COUNT(*) FROM qcm_options o
                 WHERE o.question_id = ?
                   AND ((o.is_correct = 1 AND NOT JSON_CONTAINS(?, JSON_QUOTE(o.letter)))
                     OR (o.is_correct = 0 AND JSON_CONTAINS(?, JSON_QUOTE(o.letter))))
              ) = 0 THEN 1 ELSE 0 END`,
      [
        newId(),
        user.id,
        questionId,
        JSON.stringify(chosen),
        questionId,
        JSON.stringify(chosen),
        JSON.stringify(chosen),
      ]
    );
  } catch {
    /* A lost history row must not break the practice session. */
  }
}
