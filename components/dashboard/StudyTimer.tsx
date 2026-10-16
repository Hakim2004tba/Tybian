"use client";

import { Play, Pause, RotateCcw, Clock, Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  useStudyTimer,
  formatClock,
  TIMER_PRESETS,
} from "@/components/dashboard/StudyTimerProvider";
import { cn } from "@/lib/utils";
import { formatHoursMinutes } from "@/lib/format/duration";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useFocus } from "@/components/dashboard/FocusMode";

/**
 * The full timer card.
 *
 * It owns no timer state any more: everything lives in
 * StudyTimerProvider, mounted by the dashboard layout, so a session
 * keeps running when the student navigates to another page and the
 * floating widget always agrees with this card.
 *
 * A logged session is still only ever created by THIS student's own
 * browser calling logStudySessionAction — no admin or other student can
 * write on their behalf (study_sessions_owner_all RLS, 0029) — and only
 * the final duration is sent, once, when the session ends.
 */
export function StudyTimer({ initialWeeklySeconds }: { initialWeeklySeconds: number }) {
  const { presetMinutes, secondsLeft, running, hasSession, progress, start, pause, stopAndLog, setPreset } =
    useStudyTimer();
  const { t } = useI18n();
  const { setOn } = useFocus();

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px]">
          <Clock size={17} />
          {t.dash.timer.title}
        </h3>
        <span className="num text-[12px] text-text-muted-light">
          {t.dash.timer.thisWeek} {formatHoursMinutes(initialWeeklySeconds)}
        </span>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e0f5" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#6C4CF1"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="num text-[26px] font-bold">{formatClock(secondsLeft)}</span>
        </div>

        <div className="mt-4 flex gap-2">
          {TIMER_PRESETS.map((minutes) => (
            <button
              key={minutes}
              onClick={() => setPreset(minutes)}
              className={cn(
                "num rounded-full px-3 py-1 text-[12px] transition-colors",
                presetMinutes === minutes
                  ? "bg-primary text-white"
                  : "bg-bg-light text-text-muted-light hover:text-primary"
              )}
            >
              {minutes} {t.dash.common.minShort}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          {!running ? (
            <button
              onClick={start}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
              aria-label={t.dash.timer.start}
            >
              <Play size={18} />
            </button>
          ) : (
            <button
              onClick={pause}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
              aria-label={t.dash.timer.pause}
            >
              <Pause size={18} />
            </button>
          )}
          <button
            onClick={stopAndLog}
            disabled={!hasSession && !running}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border-light text-text-muted-light transition-colors hover:text-primary disabled:opacity-40"
            aria-label={t.dash.timer.finish}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {hasSession && (
          <p className="mt-3 flex items-center gap-1 text-[11.5px] text-text-muted-light">
            <RotateCcw size={11} /> {t.dash.timer.finishHint}
          </p>
        )}

        {/* The way in. Beside the timer rather than in the rail,
            because focus is entered when a session starts, not chosen
            from a menu. */}
        <button
          type="button"
          onClick={() => setOn(true)}
          className="mt-4 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-2 text-[12.5px] font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/10"
        >
          <Maximize2 size={14} />
          {t.dash.focus.enter}
        </button>
      </div>
    </Card>
  );
}
