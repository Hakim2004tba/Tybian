"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check, X, Minus, RotateCcw, ListRestart, ChevronLeft,
  Clock, Timer, ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { BankQuestion } from "@/lib/data/qcm-bank";
import { clock, gradeBand, summarise, verdictFor, type Verdict } from "@/lib/qcm/session";
import type { Answered } from "@/components/qcm/QcmSession";

/**
 * What the session was worth, and which questions to go back to.
 *
 * THE SCORE IS OUT OF THE WHOLE SET, not out of what was answered —
 * see lib/qcm/session.ts. Scoring over answered questions lets a
 * student answer the three they know, skip the rest, and be told they
 * got 100%.
 *
 * The review list below the score is the point of the screen. A
 * percentage alone tells a student how they did; the list tells them
 * what to do next, which is why every question is here with its
 * correct letters and its explanation one tap away.
 */
export function QcmAnalysis({
  questions,
  answers,
  elapsedSeconds,
  subjectHref,
  onRestart,
  onRetryMissed,
}: {
  questions: BankQuestion[];
  answers: Record<string, Answered>;
  elapsedSeconds: number;
  subjectHref: string;
  onRestart: () => void;
  onRetryMissed?: () => void;
}) {
  const { t } = useI18n();

  const summary = useMemo(
    () => summarise(Object.values(answers), questions.length),
    [answers, questions.length]
  );

  const band = gradeBand(summary.percent);
  const headline = {
    excellent: { label: t.bank.bandExcellent, hint: t.bank.bandExcellentHint, ring: "text-success" },
    good: { label: t.bank.bandGood, hint: t.bank.bandGoodHint, ring: "text-primary" },
    fair: { label: t.bank.bandFair, hint: t.bank.bandFairHint, ring: "text-gold" },
    weak: { label: t.bank.bandWeak, hint: t.bank.bandWeakHint, ring: "text-error" },
  }[band];

  /* The ring. 2πr for r=52. */
  const CIRCUMFERENCE = 326.7;

  return (
    <div className="flex flex-col gap-3">
      {/* ================= the score ================= */}
      <div className="animate-pop-in relative overflow-hidden rounded-3xl border border-border-light bg-surface-light p-5 md:p-7">
        <div className="pointer-events-none absolute -end-16 -top-24 h-56 w-56 animate-drift rounded-full bg-primary/[0.07] blur-3xl" />

        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative h-[124px] w-[124px] shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="9" className="stroke-black/[0.07]" />
              <circle
                cx="60" cy="60" r="52" fill="none" strokeWidth="9" strokeLinecap="round"
                className={"stroke-current transition-[stroke-dashoffset] duration-[1.1s] ease-out " + headline.ring}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - summary.percent / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={"num text-[30px] font-extrabold leading-none " + headline.ring}>
                {summary.percent}
                <span className="text-[16px]">%</span>
              </span>
              <span className="num mt-1 text-[11.5px] text-text-muted-light">
                {summary.right} / {summary.total}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-start">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted-light">
              {t.bank.analysisTitle}
            </p>
            <p className="mt-1 text-[21px] font-extrabold text-text-primary-light">{headline.label}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary-light">
              {headline.hint}
            </p>

            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Stat icon={<Clock size={13} />} label={t.bank.time} value={clock(elapsedSeconds)} />
              <Stat icon={<Timer size={13} />} label={t.bank.avgTime} value={clock(summary.averageSeconds)} />
            </div>
          </div>
        </div>

        {/* ---- the four counts ---- */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Count tone="success" value={summary.right} label={t.bank.right} />
          <Count tone="gold" value={summary.partial} label={t.bank.partial} />
          <Count tone="error" value={summary.wrong} label={t.bank.wrong} />
          <Count tone="muted" value={summary.skipped} label={t.bank.skipped} />
        </div>

        {/* ---- what to do next ---- */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {onRetryMissed && (
            <button
              type="button"
              onClick={onRetryMissed}
              className="flex grow items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[13.5px] font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99]"
            >
              <RotateCcw size={15} />
              {t.bank.retryWrong}
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="flex grow items-center justify-center gap-2 rounded-2xl border border-border-light px-4 py-3 text-[13.5px] font-semibold text-text-secondary-light transition hover:border-primary/40 hover:text-primary"
          >
            <ListRestart size={15} />
            {t.bank.restart}
          </button>
          <Link
            href={subjectHref}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-border-light px-4 py-3 text-[13.5px] text-text-secondary-light transition hover:border-primary/40 hover:text-primary"
          >
            <ChevronLeft size={15} className="rtl:rotate-180" />
            {t.bank.backToSubject}
          </Link>
        </div>
      </div>

      {/* ================= question by question ================= */}
      <div className="rounded-3xl border border-border-light bg-surface-light p-3 md:p-4">
        <p className="px-1.5 pb-2 text-[12.5px] font-bold text-text-secondary-light">
          {t.bank.perQuestion}
        </p>
        <ul className="flex flex-col gap-1.5">
          {questions.map((question, i) => (
            <ReviewRow
              key={question.id}
              number={i + 1}
              question={question}
              answer={answers[question.id]}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-black/[0.05] px-3 py-1.5 text-[12px] text-text-secondary-light">
      {icon}
      {label}
      <span className="num font-bold tabular-nums text-text-primary-light">{value}</span>
    </span>
  );
}

function Count({
  tone,
  value,
  label,
}: {
  tone: "success" | "gold" | "error" | "muted";
  value: number;
  label: string;
}) {
  const look = {
    success: "bg-success/[0.08] text-success",
    gold: "bg-gold/[0.12] text-gold",
    error: "bg-error/[0.08] text-error",
    muted: "bg-black/[0.05] text-text-muted-light",
  }[tone];

  return (
    <div className={"rounded-2xl px-3 py-3 text-center " + look}>
      <p className="num text-[22px] font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[11.5px] font-semibold opacity-80">{label}</p>
    </div>
  );
}

/** One question in the review list, closed until asked for. */
function ReviewRow({
  number,
  question,
  answer,
}: {
  number: number;
  question: BankQuestion;
  answer: Answered | undefined;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const verdict: Verdict = answer ? verdictFor(answer) : "skipped";
  const correct = question.options.filter((o) => o.isCorrect).map((o) => o.letter);

  const look = {
    right: { chip: "bg-success/15 text-success", icon: <Check size={12} strokeWidth={3.2} /> },
    partial: { chip: "bg-gold/20 text-gold", icon: <Minus size={12} strokeWidth={3.2} /> },
    wrong: { chip: "bg-error/15 text-error", icon: <X size={12} strokeWidth={3.2} /> },
    skipped: { chip: "bg-black/[0.07] text-text-muted-light", icon: <Minus size={12} /> },
  }[verdict];

  return (
    <li className="overflow-hidden rounded-2xl border border-border-light">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition hover:bg-black/[0.02]"
      >
        <span className={"num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11.5px] font-bold " + look.chip}>
          {number}
        </span>
        <span dir="auto" className="min-w-0 flex-1 truncate text-[13px] text-text-primary-light">
          {question.statement}
        </span>
        <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full " + look.chip}>
          {look.icon}
        </span>
        <ChevronDown
          size={15}
          className={"shrink-0 text-text-muted-light transition " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div className="animate-rise-in border-t border-border-light bg-black/[0.015] px-3 py-3">
          <p dir="auto" className="text-[13.5px] font-semibold leading-relaxed text-text-primary-light">
            {question.statement}
          </p>

          <ul className="mt-2.5 flex flex-col gap-1.5">
            {question.options.map((option) => {
              const mine = answer?.chosen.includes(option.letter) ?? false;
              const isRight = option.isCorrect;
              const tone = isRight
                ? "border-success/50 bg-success/[0.07]"
                : mine
                  ? "border-error/50 bg-error/[0.06]"
                  : "border-border-light opacity-60";

              return (
                <li
                  key={option.letter}
                  className={"flex items-start gap-2.5 rounded-xl border px-3 py-2 " + tone}
                >
                  <span
                    className={
                      "flex h-5.5 w-5.5 min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold " +
                      (isRight ? "bg-success text-white" : mine ? "bg-error text-white" : "bg-black/[0.06] text-text-secondary-light")
                    }
                  >
                    {isRight ? <Check size={11} strokeWidth={3.5} /> : mine ? <X size={11} strokeWidth={3.5} /> : option.letter}
                  </span>
                  <span dir="auto" className="text-[12.5px] leading-relaxed text-text-primary-light">
                    {option.body}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="num mt-2.5 text-[11.5px] text-text-muted-light">
            {t.bank.correctAnswer}: <span className="font-bold text-success">{correct.join(" · ")}</span>
            {answer && answer.chosen.length > 0 && (
              <>
                {" — "}
                {t.bank.yourPick}: <span className="font-bold">{answer.chosen.join(" · ")}</span>
              </>
            )}
          </p>

          <p
            dir="auto"
            className="mt-2 whitespace-pre-wrap rounded-xl bg-primary/[0.05] p-3 text-[12.5px] leading-[1.85] text-text-secondary-light"
          >
            {question.explanation || t.bank.noExplanation}
          </p>
        </div>
      )}
    </li>
  );
}
