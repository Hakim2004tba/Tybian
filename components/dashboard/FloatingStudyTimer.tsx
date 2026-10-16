"use client";

import { Play, Pause, Square } from "lucide-react";
import { useStudyTimer, formatClock } from "@/components/dashboard/StudyTimerProvider";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useFloatingOffsets } from "@/lib/ui/floating-offsets";

/**
 * The running timer, following the student across every dashboard page.
 *
 * Renders nothing until a session actually exists, so it never occupies
 * a corner for someone who is not studying. It reads the same provider
 * as the full card, so the two can never disagree — pausing here pauses
 * there.
 *
 * Positioned bottom-left because the layout is RTL: that is the side
 * away from the sidebar, and it clears the mobile drawer's edge.
 */
export function FloatingStudyTimer() {
  const timer = useStudyTimer();
  const offsets = useFloatingOffsets();
  const { t } = useI18n();

  if (!timer.running && !timer.hasSession) return null;

  const R = 18;
  const C = 2 * Math.PI * R;

  return (
    <div className={cn("pointer-events-none fixed end-6 z-40 print:hidden md:end-8", offsets.timer)}>
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-academy-deep px-3 py-2 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
            <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
            <circle
              cx="22"
              cy="22"
              r={R}
              fill="none"
              stroke="#22D3B8"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - timer.progress)}
            />
          </svg>
          <span className="num text-[10px] font-bold text-white">
            {Math.ceil(timer.secondsLeft / 60)}
          </span>
        </div>

        <span className="num min-w-[52px] text-[15px] font-bold tabular-nums text-white">
          {formatClock(timer.secondsLeft)}
        </span>

        {timer.running ? (
          <button
            type="button"
            onClick={timer.pause}
            aria-label={t.dash.timer.pause}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <Pause size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={timer.start}
            aria-label={t.dash.timer.resume}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
          >
            <Play size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={timer.stopAndLog}
          aria-label={t.dash.timer.finishSession}
          title={t.dash.timer.finish}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-error/80"
        >
          <Square size={12} />
        </button>
      </div>
    </div>
  );
}
