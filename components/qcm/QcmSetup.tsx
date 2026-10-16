"use client";

import { useState } from "react";
import { Shuffle, Zap, FileCheck2, Play, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { QcmMark } from "@/components/qcm/QcmMark";

export type SessionConfig = {
  /** 0 means every question in the topic. */
  count: number;
  mode: "instant" | "exam";
  shuffle: boolean;
};

/*
  The lengths offered. Not a free number field: a student choosing
  "37" is choosing nothing meaningful, and a text input here is one
  more thing to fill in before the thing they came to do. Anything
  larger than the topic is dropped.
*/
const LENGTHS = [10, 20, 40];

export function QcmSetup({
  total,
  onStart,
}: {
  total: number;
  onStart: (config: SessionConfig) => void;
}) {
  const { t } = useI18n();

  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<SessionConfig["mode"]>("instant");
  const [shuffle, setShuffle] = useState(true);

  const lengths = [...LENGTHS.filter((n) => n < total), 0];

  return (
    <div className="animate-rise-in overflow-hidden rounded-3xl border border-border-light bg-surface-light">
      {/* ---- the purple head ---- */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[#3D1E8F] px-5 py-6 md:px-7 md:py-7">
        {/* Two soft lights behind the mark, drifting very slowly. The
            head is a flat block of purple otherwise. */}
        <div className="pointer-events-none absolute -end-10 -top-16 h-44 w-44 animate-drift rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 start-10 h-40 w-40 animate-drift rounded-full bg-secondary/20 blur-2xl [animation-delay:-8s]" />

        <div className="relative flex items-center gap-3">
          <QcmMark className="h-7 w-auto text-white" title="QCM" />
          <span className="h-6 w-px bg-white/25" />
          <div>
            <p className="text-[15px] font-bold text-white">{t.bank.setupTitle}</p>
            <p className="num text-[12.5px] text-white/70">
              {total} {t.bank.available}
            </p>
          </div>
        </div>

        <p className="relative mt-3 max-w-md text-[13px] leading-relaxed text-white/75">
          {t.bank.setupSubtitle}
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5 md:p-7">
        {/* ---- how many ---- */}
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-text-secondary-light">
            {t.bank.countLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {lengths.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                aria-pressed={count === n}
                className={
                  "num min-w-[58px] rounded-xl border px-4 py-2 text-[13.5px] font-semibold transition " +
                  (count === n
                    ? "border-primary bg-primary text-white shadow-sm shadow-primary/30"
                    : "border-border-light text-text-secondary-light hover:border-primary/40 hover:text-primary")
                }
              >
                {n === 0 ? t.bank.all : n}
              </button>
            ))}
          </div>
        </div>

        {/* ---- instant correction, or exam ---- */}
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-text-secondary-light">
            {t.bank.modeLabel}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { key: "instant", icon: Zap, label: t.bank.modeInstant, hint: t.bank.modeInstantHint },
                { key: "exam", icon: FileCheck2, label: t.bank.modeExam, hint: t.bank.modeExamHint },
              ] as const
            ).map((option) => {
              const active = mode === option.key;
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setMode(option.key)}
                  aria-pressed={active}
                  className={
                    "flex items-start gap-3 rounded-2xl border p-3.5 text-start transition " +
                    (active
                      ? "border-primary bg-primary/[0.06]"
                      : "border-border-light hover:border-primary/40")
                  }
                >
                  <span
                    className={
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition " +
                      (active ? "bg-primary text-white" : "bg-black/[0.05] text-text-muted-light")
                    }
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-text-primary-light">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-text-secondary-light">
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- shuffle ---- */}
        <button
          type="button"
          onClick={() => setShuffle((s) => !s)}
          aria-pressed={shuffle}
          className="flex items-center gap-3 rounded-2xl border border-border-light px-3.5 py-3 text-start transition hover:border-primary/40"
        >
          <span
            className={
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition " +
              (shuffle ? "border-primary bg-primary text-white" : "border-border-light")
            }
          >
            {shuffle && <Check size={12} strokeWidth={3.5} />}
          </span>
          <Shuffle size={15} className="shrink-0 text-text-muted-light" />
          <span className="text-[13px] text-text-primary-light">{t.bank.shuffle}</span>
        </button>

        <button
          type="button"
          onClick={() => onStart({ count, mode, shuffle })}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99]"
        >
          <Play size={16} fill="currentColor" />
          {t.bank.start}
        </button>
      </div>
    </div>
  );
}
