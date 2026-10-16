import "server-only";
import { streamGemini, probeGemini, GEMINI_MODEL, type ChatTurn } from "@/lib/ai/gemini";
import { streamGroq, probeGroq, GROQ_MODEL } from "@/lib/ai/groq";

/**
 * Which model answers, decided by one environment variable.
 *
 * The route and the widget do not know or care who the provider is —
 * that was the point of keeping everything vendor-specific inside a
 * single module. This is the switch.
 *
 *   AI_PROVIDER=groq     + GROQ_API_KEY    → Groq
 *   AI_PROVIDER=gemini   + GEMINI_API_KEY  → Gemini  (the default)
 *
 * Changing provider is therefore two lines in .env and a restart, with
 * no rebuild — which matters because the reason to change is usually
 * that the current one is failing right now.
 *
 * Auto-fallback between PROVIDERS is deliberately not done. The two
 * answer in different voices and at different lengths, and a student
 * who asks the same question twice and gets two different characters
 * back learns to distrust it. Switching is a decision, not a reflex.
 */

export type AiProvider = "gemini" | "groq";

export function activeProvider(): AiProvider {
  return process.env.AI_PROVIDER === "groq" ? "groq" : "gemini";
}

export function activeModel(): string {
  return activeProvider() === "groq" ? GROQ_MODEL : GEMINI_MODEL;
}

function apiKeyFor(provider: AiProvider): string | undefined {
  return provider === "groq" ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;
}

export function isAiConfigured(): boolean {
  return Boolean(apiKeyFor(activeProvider()));
}

/** Streams a reply from whichever provider is configured. */
export function streamAnswer(input: {
  system: string;
  history: ChatTurn[];
  question: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const provider = activeProvider();
  const apiKey = apiKeyFor(provider)!;

  return provider === "groq"
    ? streamGroq({ ...input, apiKey })
    : streamGemini({ ...input, apiKey });
}

/** One tiny call against the ACTIVE provider, for /api/admin/diagnostics. */
export async function probeAi(): Promise<{
  provider: AiProvider;
  ok: boolean;
  status: number;
  model: string;
  detail: string | null;
}> {
  const provider = activeProvider();
  const result = provider === "groq" ? await probeGroq() : await probeGemini();
  return { provider, ...result };
}
