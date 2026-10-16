"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Play, Pause, Square, X, Sprout } from "lucide-react";
import { useStudyTimer, formatClock } from "@/components/dashboard/StudyTimerProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { MINUTES_PER_TREE } from "@/lib/study/garden";

/* ------------------------------------------------------------------ */
/*  The switch                                                         */
/* ------------------------------------------------------------------ */

const FocusContext = createContext<{ on: boolean; setOn: (v: boolean) => void } | null>(null);

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used inside FocusProvider");
  return ctx;
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <FocusContext.Provider value={{ on, setOn }}>
      {children}
      <FocusOverlay />
    </FocusContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  The mode                                                           */
/* ------------------------------------------------------------------ */

/**
 * FOCUS MODE — the platform gets out of the way.
 *
 * A mode, not a page: the route does not change, the session keeps
 * running, and leaving puts the student back exactly where they were.
 * That matters because focus is entered in the middle of work, not
 * navigated to.
 *
 * What is on screen is deliberately almost nothing:
 *
 *   THE WALL CLOCK, very large. A student revising wants to know what
 *   time it IS far more often than how long is left — "can I finish
 *   this chapter before the lecture" is a question about the clock on
 *   the wall. It is the only thing anyone should be able to read from
 *   across a desk, so it is the only thing set large.
 *
 *   THE SESSION, small and underneath. Still legible, still
 *   controllable, but no longer the thing being stared at. A countdown
 *   given the whole screen invites watching it, which is the opposite
 *   of studying.
 *
 *   ONE LINE ABOUT THE TREE. It is the reason the timer is running at
 *   all, and it is the only progress worth showing here.
 *
 * Everything else — the rail, the search, the notifications, the
 * assistant — is gone. Escape leaves.
 */
function FocusOverlay() {
  const { on, setOn } = useFocus();
  const timer = useStudyTimer();
  const { t, locale } = useI18n();
  const labels = t.dash.focus;

  const [now, setNow] = useState<Date | null>(null);

  /* Rendered from a state set after mount, never from `new Date()` at
     render time: the server and the browser are in different seconds
     (and often different time zones), and that is a hydration mismatch
     on the one element the whole screen is about. */
  useEffect(() => {
    if (!on) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [on]);

  /* Escape leaves, and the page behind does not scroll while it is
     covered — a hidden page scrolling under a full-screen overlay is
     how a student returns to find they have lost their place. */
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOn(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [on, setOn]);

  if (!on) return null;

  const ar = locale === "ar";
  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  /* The colon carries the second, so nothing else on screen has to
     move. A blinking separator is the one motion a clock is allowed. */
  const tick = now ? now.getSeconds() % 2 === 0 : true;

  const dateLabel = now
    ? new Intl.DateTimeFormat(ar ? "ar-DZ" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now)
    : "";

  /* Minutes still owed to the next tree, from the session in hand. */
  const minutesThisSession = Math.floor(timer.elapsedSeconds / 60);
  const toTree = Math.max(0, MINUTES_PER_TREE - (minutesThisSession % MINUTES_PER_TREE));

  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-[#0B0716] px-6 text-center motion-safe:animate-[focusIn_420ms_cubic-bezier(0.22,1,0.36,1)]"
    >
      {/* Two very slow lights. The room breathing, not an animation to
          look at — 26s and 34s so they never sync into a pulse. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-1/4 start-[-15%] h-[38rem] w-[38rem] rounded-full bg-primary/[0.13] blur-3xl motion-safe:animate-drift"
      />
      <span
        aria-hidden
        style={{ animationDelay: "-17s", animationDuration: "34s" }}
        className="pointer-events-none absolute -bottom-1/4 end-[-15%] h-[34rem] w-[34rem] rounded-full bg-secondary/[0.10] blur-3xl motion-safe:animate-drift"
      />

      {/* A thin line across the very top: the session's progress through
          its preset, readable without being looked at. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-white/[0.06]">
        <span
          className="block h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-1000"
          style={{ width: `${Math.round(timer.progress * 100)}%` }}
        />
      </span>

      <button
        type="button"
        onClick={() => setOn(false)}
        aria-label={labels.exit}
        className="absolute end-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-white/35 hover:text-white"
      >
        <X size={18} />
      </button>

      {/* ---- the wall clock ---- */}
      <div className="relative">
        <p className="num select-none font-bold leading-none text-white [font-size:clamp(4.5rem,22vw,13rem)]">
          {hh}
          <span className={tick ? "opacity-100" : "opacity-25"} style={{ transition: "opacity 220ms" }}>
            :
          </span>
          {mm}
        </p>
        {dateLabel && (
          <p className="mt-3 text-[13.5px] tracking-wide text-white/45">{dateLabel}</p>
        )}
      </div>

      {/* ---- the session, small ---- */}
      <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 backdrop-blur-sm">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
            <circle cx="30" cy="30" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="4" />
            <circle
              cx="30"
              cy="30"
              r={R}
              fill="none"
              stroke="url(#focusRing)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - timer.progress)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
            <defs>
              <linearGradient id="focusRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8B6CF6" />
                <stop offset="100%" stopColor="#22D3B8" />
              </linearGradient>
            </defs>
          </svg>
          <span className="num text-[12.5px] font-semibold text-white/90">
            {formatClock(timer.secondsLeft)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={timer.running ? timer.pause : timer.start}
            aria-label={timer.running ? labels.pause : labels.start}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
          >
            {timer.running ? <Pause size={17} /> : <Play size={17} className="ms-0.5" />}
          </button>
          {timer.hasSession && (
            <button
              type="button"
              onClick={timer.stopAndLog}
              aria-label={labels.finish}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/35 hover:text-white"
            >
              <Square size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ---- why the timer is running ---- */}
      <p className="mt-6 flex items-center gap-2 text-[13px] text-white/45">
        <Sprout size={15} className="text-secondary" />
        {labels.nextTree.replace("{n}", String(toTree))}
      </p>

      <p className="absolute bottom-6 text-[12px] text-white/25">{labels.escHint}</p>
    </div>
  );
}
