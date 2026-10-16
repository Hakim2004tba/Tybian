"use client";

import { useEffect, useRef, useState } from "react";
import { STREAM_END } from "@/lib/ai/protocol";
import { AI_ASK_EVENT } from "@/lib/ai/ask-event";
import { Markdown } from "@/components/ai/Markdown";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send, RotateCcw, AlertTriangle, PanelRightClose, Minimize2 } from "lucide-react";
import { suggestedPrompts } from "@/lib/ai/context";
import { ASSISTANT_NAME } from "@/lib/ai/system-prompt";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useFloatingOffsets } from "@/lib/ui/floating-offsets";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The floating study assistant.
 *
 * Deliberate choices:
 *  - It reads the CURRENT PATH and sends it with each question, so
 *    "اشرح لي هذا الدرس" resolves to the lesson actually on screen.
 *    That is the difference between a study companion and a chat box
 *    that happens to float.
 *  - The opening state offers three prompts chosen for where the
 *    student already is. An empty box invites nothing.
 *  - There is no per-student cap: the provider's own free quota is the
 *    only ceiling, so nothing here needs to ration questions.
 *  - Transcripts live in component state only — never sent anywhere but
 *    the model, never stored server-side (see migration 0037).
 *  - Docked on the LEFT. The layout is RTL, so the sidebar owns the
 *    right edge; anything pinned there covers the navigation.
 */
export function AiAssistant() {
  const pathname = usePathname();
  const { t: T } = useI18n();
  const offsets = useFloatingOffsets();
  const t = T.ai;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
    BUBBLE OR SIDEBAR.

    It opens as the floating panel it has always been. Once open, the
    student can dock it to the side, where it stays put and the page
    reflows beside it — better for reading a lesson and asking about it
    at the same time, which is most of what it is used for.

    Remembered in localStorage, per browser: a preference about the
    shape of a panel is not worth a database round trip on every page,
    and getting it back on the next visit is the whole point. Reading is
    wrapped because a private window can throw on access rather than
    return null.
  */
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    try {
      setDocked(window.localStorage.getItem("tibyan_ai_docked") === "1");
    } catch {
      /* storage blocked — the floating default is fine */
    }
  }, []);

  /*
    MAKE ROOM, rather than cover.

    A docked panel that floats over the page hides exactly what the
    student is asking about — on the dashboard it covered the whole
    content column. The panel is `fixed` (it must be: it is full
    height and must not scroll with the article), so the only way for
    the page to yield is to shrink the document itself. A class on
    <html> does that, and globals.css owns the width in one place.

    Only while docked AND open, and only from md up: on a phone the
    docked form is a bottom sheet, which needs no horizontal room.
  */
  useEffect(() => {
    const on = docked && open;
    document.documentElement.classList.toggle("ai-docked", on);
    return () => document.documentElement.classList.remove("ai-docked");
  }, [docked, open]);

  /*
    ASKED FROM ELSEWHERE.

    The reader's highlight popover offers "Ask AI" about the sentence
    just selected — the single most useful thing a study assistant can
    do, because the student has already told it what they are confused
    by. Passing that across would normally mean lifting this whole
    component's state into a context and rewiring every page that
    renders it.

    A window event instead: one listener here, one dispatch there, and
    the two stay entirely independent. See lib/ai/ask-event.ts for the
    contract.
  */
  useEffect(() => {
    function onAsk(event: Event) {
      const detail = (event as CustomEvent<{ question?: string }>).detail;
      const question = detail?.question?.trim();
      if (!question) return;

      setOpen(true);
      setDocked(true);
      void ask(question);
    }

    window.addEventListener(AI_ASK_EVENT, onAsk);
    return () => window.removeEventListener(AI_ASK_EVENT, onAsk);
    // `send` is stable for the life of the component; re-subscribing on
    // every render would drop events fired mid-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDock() {
    setDocked((wasDocked) => {
      const next = !wasDocked;
      try {
        window.localStorage.setItem("tibyan_ai_docked", next ? "1" : "0");
      } catch {
        /* the preference simply will not persist */
      }
      return next;
    });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || streaming) return;

    setError(null);
    setDraft("");
    const history = turns;
    setTurns([...history, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          history,
          context: { path: pathname, title: document.title },
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t.unreachable);
        setTurns(history);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let finished = false;

      // Append each chunk as it arrives rather than waiting for the
      // whole reply — the reason for streaming in the first place.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });

        /*
          The end marker tells a finished answer from a severed
          connection — see lib/ai/protocol.ts. Stripped before display;
          the student should never see it.
        */
        if (acc.includes(STREAM_END)) {
          finished = true;
          acc = acc.split(STREAM_END).join("");
        }

        setTurns([...history, { role: "user", content: text }, { role: "assistant", content: acc }]);
      }

      /*
        The stream ended without the model saying it was done. Until now
        this rendered as a confident half-sentence with nothing to
        suggest it had been cut off, which is how "it answers half then
        stops" was experienced. Saying so is the difference between a
        bug the student works around and one they can report.
      */
      if (!finished) setError(t.truncated);

    } catch {
      setError(t.interrupted);
    } finally {
      setStreaming(false);
    }
  }

  const prompts = suggestedPrompts({ path: pathname });

  return (
    <>
      {/* The trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t.closeAssistant : `${t.ask} ${ASSISTANT_NAME}`}
        aria-expanded={open}
        className={cn(
          "ai-dock-shift fixed end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full md:end-8",
          offsets.assistant,
          "bg-gradient-to-br from-primary to-secondary text-white",
          "shadow-[0_10px_30px_-6px_rgba(108,76,241,0.7)] transition-transform duration-200",
          "hover:scale-105 active:scale-95 print:hidden"
        )}
      >
        {open ? (
          <X size={22} />
        ) : (
          <span className="flex flex-col items-center leading-none">
            <Sparkles size={16} />
            <span className="mt-0.5 text-[10px] font-bold tracking-wide">AI</span>
          </span>
        )}
        {!open && (
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40"
            style={{ animationDuration: "3s" }}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-white/10 bg-white print:hidden",
            docked
              ? /*
                  DOCKED: a full-height column against the side, sharing
                  the screen with the page instead of covering a corner
                  of it. On a phone there is no room to share, so it
                  stays a sheet from the bottom — a 380px column beside
                  a 375px screen is not a column, it is the screen.
                */
                "inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl shadow-[0_-16px_50px_-16px_rgba(0,0,0,0.45)] " +
                "md:inset-y-0 md:bottom-auto md:end-0 md:start-auto md:h-screen md:max-h-none md:w-[380px] " +
                "md:rounded-none md:border-y-0 md:shadow-[-16px_0_50px_-16px_rgba(0,0,0,0.35)]"
              : cn(
                  "end-6 max-h-[min(560px,calc(100vh-16rem))] w-[min(380px,calc(100vw-2rem))] rounded-2xl shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] md:end-8",
                  offsets.panel
                )
          )}
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-academy-deep px-4 py-3">
            <div
              className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-primary/40 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-secondary">
                  <Sparkles size={15} />
                </span>
                <div>
                  <p className="text-[14px] font-bold leading-tight text-white">{ASSISTANT_NAME}</p>
                  <p className="text-[11px] leading-tight text-white/55">{t.tagline}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/*
                  The shape control. Placed in the header rather than a
                  settings menu because it is a one-tap preference the
                  student will change with their reading, not configure
                  once.
                */}
                <button
                  type="button"
                  onClick={toggleDock}
                  aria-label={docked ? t.undock : t.dock}
                  title={docked ? t.undock : t.dock}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  {docked ? <Minimize2 size={15} /> : <PanelRightClose size={15} />}
                </button>

                {/* An explicit close inside the panel: the floating
                    trigger is a small target and, on short screens, can
                    end up behind the panel entirely. */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t.close}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X size={15} />
                </button>
                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTurns([]);
                      setError(null);
                    }}
                    aria-label={t.newConversation}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-academy-lavender-soft px-3 py-3">
            {turns.length === 0 ? (
              <div className="px-1 py-2">
                <p className="text-[13px] leading-relaxed text-text-secondary-light">
                  {t.intro}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => ask(t.prompts[p])}
                      className="rounded-lg border border-academy-lavender-deep bg-white px-3 py-2 text-right text-[12.5px] text-text-primary-light transition-colors hover:border-primary hover:text-primary"
                    >
                      {t.prompts[p]}
                    </button>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-muted-light">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {t.disclaimer}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                      t.role === "user"
                        ? "self-start whitespace-pre-wrap bg-primary text-white"
                        : "self-end border border-academy-lavender-deep bg-white text-text-primary-light"
                    )}
                  >
                    {/*
                      The model answers in Markdown — headings, bold,
                      numbered steps. Rendered as plain text it arrived
                      full of ### and ** and ---, which is harder to
                      read than no formatting at all.

                      The student's own message stays plain: they typed
                      characters, not syntax, and an asterisk in a
                      question should not silently become italics.
                    */}
                    {t.content ? (
                      t.role === "user" ? t.content : <Markdown text={t.content} />
                    ) : streaming && i === turns.length - 1 ? (
                      <TypingDots />
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">
                {error}
              </p>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="flex items-end gap-2 border-t border-academy-lavender bg-white px-3 py-2.5"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — the
                // convention every chat app the student already uses.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              rows={1}
              placeholder={t.placeholder}
              disabled={streaming}
              className="max-h-24 min-h-[38px] flex-1 resize-none rounded-lg border border-academy-lavender-deep bg-academy-lavender-soft px-3 py-2 text-[13px] text-text-primary-light outline-none transition-colors placeholder:text-text-muted-light focus:border-primary focus:bg-white disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !draft.trim()}
              aria-label={t.send}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function TypingDots() {
  const { t } = useI18n();

  return (
    <span className="flex gap-1 py-1" aria-label={t.ai.typing}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
