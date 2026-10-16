"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { logStudySessionAction } from "@/lib/actions/study-tools";

const STORAGE_KEY = "tibyan.studyTimer";

export const TIMER_PRESETS = [25, 45, 50] as const;

/**
 * Timer state lifted out of the card and into the dashboard layout.
 *
 * WHY A PROVIDER: the card used to hold its own useState, so navigating
 * from /dashboard to /dashboard/study unmounted it and silently threw
 * away a running session. This provider is mounted by
 * app/dashboard/layout.tsx, which Next keeps mounted across client-side
 * navigation between its children — so the timer survives page changes.
 *
 * WHY ABSOLUTE TIMESTAMPS, not a decrementing counter: browsers throttle
 * setInterval in background tabs, so a counter that subtracts one per
 * tick drifts badly the moment the student switches tab — which is
 * exactly what happens while they study. Elapsed time is therefore
 * always derived from Date.now() against a recorded start, and the
 * interval only triggers a re-render.
 *
 * localStorage persists a run across a full page RELOAD (and the
 * accidental closed tab). It stores the same absolute timestamps, so a
 * session restored ten minutes later resumes at the right point rather
 * than where it was when the tab closed. Reads and writes are wrapped:
 * private windows and blocked site-data throw on access.
 */

type Persisted = {
  presetMinutes: number;
  running: boolean;
  runStartedAt: number | null;
  accumulatedMs: number;
  sessionStartedAtIso: string | null;
};

type StudyTimerValue = {
  presetMinutes: number;
  running: boolean;
  /** True once any time has been accrued in the current session. */
  hasSession: boolean;
  elapsedSeconds: number;
  secondsLeft: number;
  /** 0..1 through the selected preset, for the progress ring. */
  progress: number;
  start: () => void;
  pause: () => void;
  stopAndLog: () => void;
  setPreset: (minutes: number) => void;
};

const StudyTimerContext = createContext<StudyTimerValue | null>(null);

export function useStudyTimer(): StudyTimerValue {
  const ctx = useContext(StudyTimerContext);
  if (!ctx) throw new Error("useStudyTimer must be used inside StudyTimerProvider");
  return ctx;
}

function readPersisted(): Persisted | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (typeof parsed?.presetMinutes !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function StudyTimerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [presetMinutes, setPresetMinutes] = useState(25);
  const [running, setRunning] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const sessionStartedAtRef = useRef<string | null>(null);
  // Forces a re-render each second; the displayed value is computed from
  // the clock, never accumulated by this tick.
  const [, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  // Restore any run that was in progress before a reload.
  useEffect(() => {
    const saved = readPersisted();
    if (saved) {
      setPresetMinutes(saved.presetMinutes);
      setRunning(saved.running);
      setRunStartedAt(saved.runStartedAt);
      setAccumulatedMs(saved.accumulatedMs);
      sessionStartedAtRef.current = saved.sessionStartedAtIso;
    }
    setHydrated(true);
  }, []);

  // Persist. Skipped until after hydration so the restored values are
  // not overwritten by the initial defaults on first render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          presetMinutes,
          running,
          runStartedAt,
          accumulatedMs,
          sessionStartedAtIso: sessionStartedAtRef.current,
        } satisfies Persisted)
      );
    } catch {
      // Private window or site data blocked — the timer still works for
      // this page session, it just will not survive a reload.
    }
  }, [hydrated, presetMinutes, running, runStartedAt, accumulatedMs]);

  const elapsedMs = accumulatedMs + (running && runStartedAt ? Date.now() - runStartedAt : 0);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const totalSeconds = presetMinutes * 60;
  const secondsLeft = Math.max(0, totalSeconds - elapsedSeconds);

  const finish = useCallback(
    (secondsToLog: number) => {
      setRunning(false);
      setRunStartedAt(null);
      setAccumulatedMs(0);

      const startedAt = sessionStartedAtRef.current ?? new Date().toISOString();
      sessionStartedAtRef.current = null;

      if (secondsToLog > 0) {
        void logStudySessionAction(secondsToLog, startedAt).then(() => router.refresh());
      }
    },
    [router]
  );

  // Tick + completion. The interval exists to re-render and to notice
  // that the target has been passed; it never adds up time itself.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setNow(Date.now());
      const ms = accumulatedMs + (runStartedAt ? Date.now() - runStartedAt : 0);
      if (Math.floor(ms / 1000) >= totalSeconds) finish(totalSeconds);
    }, 1000);
    return () => clearInterval(id);
  }, [running, runStartedAt, accumulatedMs, totalSeconds, finish]);

  const start = useCallback(() => {
    if (!sessionStartedAtRef.current) sessionStartedAtRef.current = new Date().toISOString();
    setRunStartedAt(Date.now());
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    setAccumulatedMs((prev) => prev + (runStartedAt ? Date.now() - runStartedAt : 0));
    setRunStartedAt(null);
    setRunning(false);
  }, [runStartedAt]);

  const stopAndLog = useCallback(() => {
    const ms = accumulatedMs + (running && runStartedAt ? Date.now() - runStartedAt : 0);
    finish(Math.floor(ms / 1000));
  }, [accumulatedMs, running, runStartedAt, finish]);

  const setPreset = useCallback(
    (minutes: number) => {
      // Changing the length mid-session would silently redefine what the
      // student already studied, so it is only allowed from a clean state.
      if (running || accumulatedMs > 0) return;
      setPresetMinutes(minutes);
    },
    [running, accumulatedMs]
  );

  const value: StudyTimerValue = {
    presetMinutes,
    running,
    hasSession: elapsedSeconds > 0,
    elapsedSeconds,
    secondsLeft,
    progress: totalSeconds > 0 ? Math.min(1, elapsedSeconds / totalSeconds) : 0,
    start,
    pause,
    stopAndLog,
    setPreset,
  };

  return <StudyTimerContext.Provider value={value}>{children}</StudyTimerContext.Provider>;
}

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
