import "server-only";

/**
 * Minimal Gemini client for the study assistant.
 *
 * Raw fetch rather than a vendor SDK on purpose: this integration is one
 * streaming POST. An SDK would add a dependency, its own release
 * cadence, and a second place for the model name to live — for a single
 * endpoint that is a worse trade. Everything provider-specific is
 * confined to this file, so swapping providers later means rewriting
 * one module, not touching the route or the widget.
 *
 * Stateless mode (`store: false`) is deliberate: Google's Interactions
 * API can hold the conversation server-side and continue it by id, but
 * that would place students' questions — which include symptoms and
 * exam anxieties — in a third party's storage under an identifier this
 * platform hands out. History is replayed from the client each turn
 * instead, matching the "no transcripts stored" rule in migration 0037.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

/** The docs show more than one current flash model id, so it is an env
 *  var with a default: a wrong guess becomes a config change, not a
 *  rebuild. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * A second model to try when the first is overloaded.
 *
 * Empty by default, and deliberately not guessed. Measured on the live
 * server, the assistant's real failure was:
 *
 *   503: gemini-3.8-flash is currently experiencing high demand
 *
 * — not a bad key, not a wrong id, not an exhausted quota. Google's own
 * capacity. Retrying (below) clears most of those, but a model that is
 * popular enough to be short of capacity will be short of it again, and
 * the only real cure is somewhere else to go.
 *
 * Set GEMINI_MODEL_FALLBACK in the environment to a model you have
 * confirmed works on your key. Shipping an id I cannot verify would
 * turn one broken path into two.
 */
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_MODEL_FALLBACK || "";

/** 503 and 429 are worth retrying; 400 and 401 never are. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type GeminiStreamResult = {
  /** Async iterator of text deltas as they arrive. */
  chunks: AsyncGenerator<string>;
};

function toSteps(history: ChatTurn[], question: string) {
  const steps = history.map((t) => ({
    type: t.role === "user" ? "user_input" : "model_output",
    content: [{ type: "text", text: t.content }],
  }));
  steps.push({ type: "user_input", content: [{ type: "text", text: question }] });
  return steps;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Streams a reply. Throws GeminiError with the HTTP status on failure so
 * the caller can distinguish a bad key (401/403) and an exhausted free
 * quota (429) from a genuine outage — those need different messages,
 * and "try again" is wrong advice for the first two.
 */
export async function* streamGemini({
  system,
  history,
  question,
  apiKey,
  signal,
}: {
  system: string;
  history: ChatTurn[];
  question: string;
  apiKey: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  /*
    TRY, WAIT, TRY AGAIN, THEN TRY ELSEWHERE.

    An overloaded model is a transient condition and Google says so in
    the error text — "spikes in demand are usually temporary". A single
    attempt turns that temporary spike into a student seeing nothing at
    all, which is how this read as "the assistant is broken".

    Two short waits, then the fallback model if one is configured. The
    delays are deliberately small: a student is watching a blank panel,
    and a reply that takes six seconds is worse than a clear refusal.

    Only the CONNECTION is retried. Once bytes are flowing the reply is
    already being written on screen, and starting over would rewind
    text the student is mid-sentence through.
  */
  const attempts: { model: string; waitMs: number }[] = [
    { model: GEMINI_MODEL, waitMs: 0 },
    { model: GEMINI_MODEL, waitMs: 700 },
    { model: GEMINI_MODEL, waitMs: 1800 },
  ];
  if (GEMINI_FALLBACK_MODEL) {
    attempts.push({ model: GEMINI_FALLBACK_MODEL, waitMs: 0 });
  }

  let res: Response | null = null;
  let lastStatus = 0;
  let lastDetail = "";

  for (const attempt of attempts) {
    if (attempt.waitMs) await sleep(attempt.waitMs);

    res = await fetch(`${ENDPOINT}?alt=sse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: attempt.model,
        input: toSteps(history, question),
        system_instruction: system,
        stream: true,
        store: false,
        generation_config: { thinking_level: "low" },
      }),
      signal,
    });

    if (res.ok && res.body) break;

    lastStatus = res.status;
    lastDetail = await res.text().catch(() => "");
    res = null;

    // A refusal that will not change on a second ask — a bad key, a
    // malformed request — is final. Retrying it only delays the message.
    if (!RETRYABLE.has(lastStatus)) break;
  }

  if (!res || !res.body) {
    throw new GeminiError(lastDetail.slice(0, 400) || "request failed", lastStatus);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE frames are separated by a blank line and can be split across
  // network chunks, so the tail is carried over rather than parsed
  // per-chunk — parsing each chunk independently drops text whenever a
  // frame straddles a boundary.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const event = JSON.parse(payload);
          if (event.event_type === "step.delta" && event.delta?.type === "text") {
            const text = event.delta.text;
            if (typeof text === "string" && text) yield text;
          }
        } catch {
          // A frame that is not JSON (a keep-alive comment, a partial
          // write) is skipped rather than aborting a working stream.
        }
      }
    }
  }
}

/**
 * A single tiny call, to answer "is it the model, or something else?".
 *
 * The assistant fails in two ways that look identical from a chair: no
 * answer at all, and half an answer. The first is almost always the
 * request being rejected — a wrong model id, a revoked key, an
 * exhausted quota — and the reply carries Google's own explanation,
 * which until now went only to a Passenger log nobody on shared hosting
 * reads. This puts it on /api/admin/diagnostics instead.
 *
 * Non-streaming and one token long, so it costs essentially nothing and
 * cannot itself be cut off by a proxy timeout — which is the whole
 * point: if this succeeds and real answers still truncate, the model is
 * exonerated and the problem is the connection, not the configuration.
 */
export async function probeGemini(): Promise<{
  ok: boolean;
  status: number;
  model: string;
  detail: string | null;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, model: GEMINI_MODEL, detail: "GEMINI_API_KEY is not set" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [{ type: "user_input", content: [{ type: "text", text: "ping" }] }],
        store: false,
        generation_config: { thinking_level: "low" },
      }),
      // Ten seconds: a probe that hangs is itself a useful answer, but
      // not one worth waiting a minute for.
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true, status: res.status, model: GEMINI_MODEL, detail: null };

    const body = await res.text().catch(() => "");
    /* Google's message, not ours. "models/x is not found" and "API key
       not valid" need different fixes and must not be flattened into
       one sentence. The key itself is never echoed back. */
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } };
      if (parsed.error?.message) detail = `${parsed.error.status ?? res.status}: ${parsed.error.message}`;
    } catch {
      /* not JSON — the raw body is more useful than nothing */
    }
    return { ok: false, status: res.status, model: GEMINI_MODEL, detail };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      model: GEMINI_MODEL,
      detail: (error as Error).message,
    };
  }
}
