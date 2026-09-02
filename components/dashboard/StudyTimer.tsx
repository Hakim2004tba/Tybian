"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, RotateCcw, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { logStudySessionAction } from "@/lib/actions/study-tools";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "25 د", minutes: 25 },
  { label: "45 د", minutes: 45 },
  { label: "50 د", minutes: 50 },
];

function formatHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * A logged study session is only ever created by THIS student's own
 * browser calling logStudySessionAction — no admin or other student can
 * write on their behalf (study_sessions_owner_all RLS, 0029). The timer
 * state itself lives entirely client-side (setInterval); only the
 * final elapsed duration is sent to the server, once, when the session
 * ends — not a request every second, matching the same throttling
 * principle used for video progress (lib/video/progress-throttle.ts).
 */
export function StudyTimer({ initialWeeklySeconds }: { initialWeeklySeconds: number }) {
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [elapsedThisSession, setElapsedThisSession] = useState(0);
  const startedAtRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finishSession(presetMinutes * 60);
          return 0;
        }
        return prev - 1;
      });
      setElapsedThisSession((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start() {
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  function finishSession(actualElapsedSeconds: number) {
    setRunning(false);
    const startedAt = startedAtRef.current ?? new Date().toISOString();
    void logStudySessionAction(actualElapsedSeconds, startedAt).then(() => router.refresh());
    startedAtRef.current = null;
    setElapsedThisSession(0);
    setSecondsLeft(presetMinutes * 60);
  }

  function stopAndLog() {
    if (elapsedThisSession > 0) finishSession(elapsedThisSession);
    else {
      setRunning(false);
      setSecondsLeft(presetMinutes * 60);
    }
  }

  function changePreset(minutes: number) {
    if (running || elapsedThisSession > 0) return;
    setPresetMinutes(minutes);
    setSecondsLeft(minutes * 60);
  }

  const progress = 1 - secondsLeft / (presetMinutes * 60);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px]">
          <Clock size={17} />
          مؤقّت الدراسة
        </h3>
        <span className="num text-[12px] text-text-muted-light">
          هذا الأسبوع: {formatHours(initialWeeklySeconds)}
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
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              onClick={() => changePreset(p.minutes)}
              className={cn(
                "num rounded-full px-3 py-1 text-[12px] transition-colors",
                presetMinutes === p.minutes ? "bg-primary text-white" : "bg-bg-light text-text-muted-light hover:text-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          {!running ? (
            <button
              onClick={start}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
              aria-label="ابدأ"
            >
              <Play size={18} />
            </button>
          ) : (
            <button
              onClick={pause}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
              aria-label="إيقاف مؤقت"
            >
              <Pause size={18} />
            </button>
          )}
          <button
            onClick={stopAndLog}
            disabled={elapsedThisSession === 0 && !running}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border-light text-text-muted-light transition-colors hover:text-primary disabled:opacity-40"
            aria-label="إنهاء وتسجيل"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {elapsedThisSession > 0 && (
          <p className="mt-3 flex items-center gap-1 text-[11.5px] text-text-muted-light">
            <RotateCcw size={11} /> اضغط لإنهاء الجلسة وتسجيلها الآن
          </p>
        )}
      </div>
    </Card>
  );
}
