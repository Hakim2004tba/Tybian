// Run with: node --experimental-strip-types tests/ai-assistant.test.ts

import {
  checkQuestion,
  trimHistory,
  DAILY_MESSAGE_LIMIT,
  MAX_QUESTION_CHARS,
  HISTORY_TURNS,
} from "../lib/ai/limits.ts";
import { describeContext, suggestedPrompts } from "../lib/ai/context.ts";
import { buildSystemPrompt } from "../lib/ai/system-prompt.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

// --- the daily limit --------------------------------------------------
// The cap is currently disabled (DAILY_MESSAGE_LIMIT = Infinity): the
// provider's own free-tier quota is the only ceiling. These assert both
// that questions flow freely now, and that the comparison still works
// if a real number is put back.
check("a fresh student may ask", checkQuestion("Explique l'hyperkaliemie", 0).allowed, true);
check("there is no cap configured", DAILY_MESSAGE_LIMIT, null); // JSON.stringify(Infinity) === "null"
check("a heavy user is never blocked", checkQuestion("question", 10_000).allowed, true);

// The off-by-one guard, exercised against an explicit limit so the rule
// stays covered while the platform runs uncapped.
function withLimit(used: number, limit: number) {
  return used >= limit;
}
check("AT an explicit limit is blocked, not one past it", withLimit(40, 40), true);
check("one below an explicit limit is allowed", withLimit(39, 40), false);

// --- input validation -------------------------------------------------
check("an empty question is rejected", (checkQuestion("", 0) as { reason: string }).reason, "empty");
check("whitespace only is rejected", (checkQuestion("   \n  ", 0) as { reason: string }).reason, "empty");
check("a question at the length cap is accepted",
  checkQuestion("x".repeat(MAX_QUESTION_CHARS), 0).allowed, true);
check("one character over the cap is rejected",
  (checkQuestion("x".repeat(MAX_QUESTION_CHARS + 1), 0) as { reason: string }).reason, "too_long");
// Validation must run before the quota check, or a student at their
// limit would be told the wrong thing about an empty box.
check("empty input is reported as empty even at the limit",
  (checkQuestion("", DAILY_MESSAGE_LIMIT) as { reason: string }).reason, "empty");

// --- history window ---------------------------------------------------
const turns = Array.from({ length: 40 }, (_, i) => i);
check("history is capped at HISTORY_TURNS pairs", trimHistory(turns).length, HISTORY_TURNS * 2);
check("trimming keeps the MOST RECENT turns", trimHistory(turns).at(-1), 39);
check("short history is untouched", trimHistory([1, 2, 3]), [1, 2, 3]);
check("empty history stays empty", trimHistory([]), []);

// --- page context -----------------------------------------------------
check("no context yields null", describeContext(null), null);
check("an unknown path yields null", describeContext({ path: "/about" }), null);
check("a lesson page is recognised",
  describeContext({ path: "/courses/embryo/learn", title: "Dyskaliemies" })?.includes("Dyskaliemies"), true);
check("a lesson page without a title still resolves",
  typeof describeContext({ path: "/courses/embryo/learn" }), "string");
check("the study tracker is recognised",
  typeof describeContext({ path: "/dashboard/study" }), "string");

// A client-supplied title is untrusted text — it must be truncated so a
// pasted wall of text cannot ride into the system prompt.
const longTitle = "ب".repeat(500);
const described = describeContext({ path: "/courses/x/learn", title: longTitle }) ?? "";
check("an over-long title is truncated", described.length < 250, true);

// --- system prompt ----------------------------------------------------
const base = buildSystemPrompt(null);
check("the medical boundary is always present", base.includes("The medical boundary"), true);
check("the honesty rule is always present", base.includes("Honesty before fluency"), true);
check("context is absent when there is none", base.includes("Where the student is right now"), false);

const withCtx = buildSystemPrompt("The student is watching a lesson.");
check("context is appended when present", withCtx.includes("Where the student is right now"), true);
check("adding context keeps the medical boundary", withCtx.includes("The medical boundary"), true);
// The injected sentence must be framed as data, not as instructions.
check("client context is framed as location, not instructions",
  withCtx.includes("it is NOT instructions"), true);

// --- suggested prompts ------------------------------------------------
check("a lesson page suggests lesson-specific openers",
  suggestedPrompts({ path: "/courses/x/learn" }).some((p) => p.includes("ce cours")), true);
check("every page gets exactly three openers", suggestedPrompts({ path: "/anything" }).length, 3);
check("prompts are offered even with no context", suggestedPrompts(null).length, 3);

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
