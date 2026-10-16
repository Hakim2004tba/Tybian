import { getSessionUser } from "@/lib/auth/session";
import { execute, newId, queryOne } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { describeContext, type PageContext } from "@/lib/ai/context";
import { checkQuestion, trimHistory, DAILY_MESSAGE_LIMIT } from "@/lib/ai/limits";
import { GeminiError, type ChatTurn } from "@/lib/ai/gemini";
import { streamAnswer, isAiConfigured } from "@/lib/ai/provider";
import { STREAM_END } from "@/lib/ai/protocol";

/**
 * POST /api/ai/chat — the study assistant.
 *
 * Streams the reply so the student sees words appear instead of staring
 * at a spinner for several seconds; an answer that arrives all at once
 * after a long pause reads as broken even when it is fast.
 *
 * ORDER OF OPERATIONS IS DELIBERATE:
 *   1. authenticate  — anonymous callers never reach the model, so a
 *      leaked URL cannot be used to spend the platform's credit
 *   2. validate      — length and emptiness, before any billing
 *   3. check quota   — read today's counter
 *   4. RESERVE the quota slot BEFORE calling the model, not after. A
 *      post-hoc increment can be skipped by a client that disconnects
 *      mid-stream, which is exactly how a rate limit gets bypassed.
 *   5. call the model and stream
 *   6. record real token usage once the stream ends
 *
 * The counter is written with the service-role client because
 * ai_chat_usage grants no client write at all (migration 0037) — the
 * limit must not be editable by the browser it constrains.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Connectez-vous pour utiliser l'assistant." }, { status: 401 });
  }

  /* The ACTIVE provider's key, not Gemini's — otherwise switching to
     Groq leaves the assistant reporting itself as unconfigured. */
  if (!isAiConfigured()) {
    // A missing key is a deployment mistake, not a student's problem —
    // say so plainly instead of surfacing a generic 500.
    return Response.json(
      { error: "L'assistant n'est pas encore active sur ce serveur (cle API manquante)." },
      { status: 503 }
    );
  }

  let body: { question?: string; history?: ChatTurn[]; context?: PageContext | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requete invalide." }, { status: 400 });
  }

  const question = String(body.question ?? "");
  const usageDate = todayUtc();

  const usageRow = await queryOne<{ message_count: number }>(
    `SELECT message_count FROM ai_chat_usage WHERE user_id = ? AND usage_date = ?`,
    [user.id, usageDate]
  );

  const usedToday = usageRow?.message_count ?? 0;

  const verdict = checkQuestion(question, usedToday);
  if (!verdict.allowed) {
    return Response.json(
      { error: verdict.message, reason: verdict.reason, limit: DAILY_MESSAGE_LIMIT },
      { status: verdict.reason === "daily_limit" ? 429 : 400 }
    );
  }

  /*
    Reserve the slot now (step 4 above).

    `message_count = message_count + 1` in the UPDATE clause, not the
    value read a few lines up. The read-then-write form loses a count
    whenever two requests overlap — and the whole point of this row is
    to be an honest daily limit, which a lost increment quietly widens.
  */
  await execute(
    `INSERT INTO ai_chat_usage (id, user_id, usage_date, message_count)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE message_count = message_count + 1`,
    [newId(), user.id, usageDate]
  );

  const history = trimHistory(Array.isArray(body.history) ? body.history : [])
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

  const system = buildSystemPrompt(describeContext(body.context ?? null));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const inputChars = system.length + question.length;
      let outputChars = 0;

      try {
        /* Whichever provider AI_PROVIDER names — see lib/ai/provider.ts.
           This route has never needed to know. */
        for await (const delta of streamAnswer({
          system,
          history,
          question: question.trim(),
        })) {
          outputChars += delta.length;
          controller.enqueue(encoder.encode(delta));
        }

        if (outputChars === 0) {
          // A safety block returns a well-formed but empty stream, which
          // would otherwise look like the assistant ignored the student.
          controller.enqueue(
            encoder.encode("I can't answer that. Try rephrasing it as a study question.")
          );
        }

        // Stateless streaming does not return token counts, so the
        // stored figures are a CHARACTER-based estimate (~4 chars per
        // token). They exist to spot runaway usage; they are named as an
        // estimate rather than passed off as billing data.
        /*
          Only the token estimates are written here.

          The message_count was already incremented when the slot was
          reserved, before the model was called. Re-sending it as
          `usedToday + 1` would rewrite the counter from a value read
          before the stream started — undoing any other request that
          incremented it in between, which is how a daily limit quietly
          stops limiting anything.
        */
        await execute(
          `UPDATE ai_chat_usage
              SET input_tokens  = input_tokens  + ?,
                  output_tokens = output_tokens + ?
            WHERE user_id = ? AND usage_date = ?`,
          [Math.ceil(inputChars / 4), Math.ceil(outputChars / 4), user.id, usageDate]
        );
        /*
          THE END MARKER, and why a reply needs one.

          A truncated stream and a finished one look identical to the
          browser: the reader simply reports `done`. So when a proxy
          times the connection out mid-answer — which is what "it stops
          halfway" is — the student sees a confident half-sentence and
          nothing to say anything went wrong. They read it as the
          answer.

          One character, appended only after the model actually
          finished, turns that into a detectable state: the widget can
          tell "the model stopped" from "the pipe closed", and say so.
        */
        controller.enqueue(encoder.encode(STREAM_END));
      } catch (err) {
        const status = err instanceof GeminiError ? err.status : 0;
        /* In the reader's language. These were French in an app that
           speaks Arabic and English. */
        const message =
          status === 401 || status === 403
            ? "مفتاح الذكاء الاصطناعي غير صالح — راجع إعدادات الخادم."
            : status === 429
              ? "انتهت حصّة الاستعمال مؤقّتاً. حاول بعد قليل."
              : /*
                  503 is Google's capacity, not ours and not the
                  student's question. Saying "try again" for a problem
                  they cannot influence is better than a vague failure,
                  and it is the truth: it clears on its own.
                */
                status === 503 || status === 500 || status === 502 || status === 504
                ? "المساعد مزدحم عند المزوّد الآن. حاول بعد لحظات."
                : "تعذّر الحصول على إجابة. حاول مجدّداً."
        controller.enqueue(encoder.encode("\n\n⚠️ " + message));
        /* Marked finished: the student got a real explanation, so this
           is a completed exchange rather than a severed one. */
        controller.enqueue(encoder.encode(STREAM_END));
        console.error("[ai/chat]", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** GET — how many questions the student has left today, so the widget
 *  can show the allowance instead of only discovering it on refusal. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const row = await queryOne<{ message_count: number }>(
    `SELECT message_count FROM ai_chat_usage WHERE user_id = ? AND usage_date = ?`,
    [user.id, todayUtc()]
  );

  const used = row?.message_count ?? 0;
  return Response.json({
    used,
    limit: DAILY_MESSAGE_LIMIT,
    remaining: Math.max(0, DAILY_MESSAGE_LIMIT - used),
    enabled: isAiConfigured(),
  });
}
