import "server-only";
import { GeminiError, type ChatTurn } from "@/lib/ai/gemini";

/**
 * Groq — the second provider, behind an OpenAI-compatible API.
 *
 * WHY A SECOND ONE AT ALL. Measured on the live server, the assistant's
 * failures were Google's, not ours: 503 "experiencing high demand" one
 * day, 429 daily quota the next. Retrying softens the first and does
 * nothing for the second. A platform whose study assistant works until
 * lunchtime is a platform with no study assistant.
 *
 * WHY GROQ. Its free tier allows far more requests per day than the
 * Gemini one this replaces, it needs no card, it permits commercial
 * use, and it serves Qwen — the open model that research consistently
 * puts first for Arabic. Mistral's free tier is more generous still but
 * requires opting into training on your data, which contradicts the
 * `store: false` decision already made in gemini.ts; Cohere's trial key
 * forbids commercial use, and this platform sells courses.
 *
 * WHY IT IS SHORT. The API is OpenAI-shaped, so this is one POST and an
 * SSE loop. GeminiError is reused deliberately rather than renamed: the
 * route distinguishes 401 from 429 from 503 and must keep doing so
 * whichever provider is answering.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Override in the environment; Groq's catalogue moves faster than
 * deploys do.
 *
 * gpt-oss-120b rather than a Qwen model, because the study material on
 * this platform is in English and French — the courses are titled
 * "BIOCHEMISTRY - CARBOHYDRATES", the lessons are English, the
 * questions arrive in French. Qwen leads the open models on ARABIC,
 * which is the interface language here, not the subject matter.
 *
 * On published benchmarks gpt-oss-120b reaches ~86-90% MMLU depending
 * on reasoning effort, and ~53-58% on HealthBench. That second number
 * is the one worth remembering: a bit over half on health questions is
 * a revision companion, not a reference, and the assistant's own
 * framing should stay honest about that.
 */
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function* streamGroq({
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
  const messages = [
    { role: "system", content: system },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: question },
  ];

  /* Same retry shape as the Gemini path: a transient capacity error is
     worth two short waits, a rejected key is not worth any. */
  let res: Response | null = null;
  let lastStatus = 0;
  let lastDetail = "";

  for (const waitMs of [0, 700, 1800]) {
    if (waitMs) await sleep(waitMs);

    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: GROQ_MODEL, messages, stream: true }),
      signal,
    });

    if (res.ok && res.body) break;

    lastStatus = res.status;
    lastDetail = await res.text().catch(() => "");
    res = null;
    if (!RETRYABLE.has(lastStatus)) break;
  }

  if (!res || !res.body) {
    throw new GeminiError(lastDetail.slice(0, 400) || "request failed", lastStatus);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  /* Frames are separated by a blank line and can straddle a network
     chunk, so the tail is carried over — parsing each chunk on its own
     drops text wherever a frame happens to be split. */
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
          const text = event.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text) yield text;
        } catch {
          // Keep-alives and partial writes are skipped, never fatal.
        }
      }
    }
  }
}

/** The same one-call health check the Gemini module exposes. */
export async function probeGroq(): Promise<{
  ok: boolean;
  status: number;
  model: string;
  detail: string | null;
}> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, model: GROQ_MODEL, detail: "GROQ_API_KEY is not set" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true, status: res.status, model: GROQ_MODEL, detail: null };

    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* not JSON — the raw body beats nothing */
    }
    return { ok: false, status: res.status, model: GROQ_MODEL, detail };
  } catch (error) {
    return { ok: false, status: 0, model: GROQ_MODEL, detail: (error as Error).message };
  }
}
