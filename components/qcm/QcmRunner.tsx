"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check, X, Lightbulb, ChevronLeft, ChevronRight, Pause, Play,
  Flag, LayoutGrid, Clock, Minus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { BankQuestion } from "@/lib/data/qcm-bank";
import { clock, verdictFor } from "@/lib/qcm/session";
import type { Answered } from "@/components/qcm/QcmSession";

/**
 * One question at a time.
 *
 * THE ANSWER IS NEVER COMMITTED BY TAPPING AN OPTION. Tapping selects;
 * a separate confirm commits. This holds for single-answer questions
 * too, where tapping used to grade immediately — fast, and wrong, since
 * a mis-tap on a phone was a permanent wrong answer with no way back.
 *
 * Purple carries the UNDECIDED state — what you have selected but not
 * yet confirmed. Green and red only ever appear after a commit. Keeping
 * the accent out of the correction is what lets a student read the
 * screen at a glance: purple means "mine", green and red mean "judged".
 */
export function QcmRunner({
  questions,
  topicTitle,
  instant,
  answers,
  onCommit,
  onFinish,
  startAt = 0,
}: {
  questions: BankQuestion[];
  topicTitle: string;
  /** Exam mode holds every correction back to the analysis screen. */
  instant: boolean;
  answers: Record<string, Answered>;
  onCommit: (q: BankQuestion, chosen: string[], seconds: number, order: number) => void;
  onFinish: () => void;
  subjectHref: string;
  /* A resumed session opens where it was left, not at question one. */
  startAt?: number;
}) {
  const { t } = useI18n();

  const [index, setIndex] = useState(startAt);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [paused, setPaused] = useState(false);
  const [stripOpen, setStripOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const question = questions[index];
  const answer = question ? answers[question.id] : undefined;
  const committed = Boolean(answer);
  /* Once committed, the picks shown are the committed ones — not the
     working selection, which may have moved on. */
  const selected = answer ? answer.chosen : (picks[question?.id] ?? []);
  /* Exam mode defers every correction; nothing green or red appears. */
  const revealed = committed && instant;

  /* When a question is confirmed, how long it took. Reset on move. */
  const askedAt = useRef(Date.now());
  useEffect(() => {
    askedAt.current = Date.now();
  }, [index]);

  /* The session clock. One interval for the whole runner, stopped
     while paused, so a student can leave the page mid-session without
     the time counting against them. */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const correctLetters = useMemo(
    () => new Set((question?.options ?? []).filter((o) => o.isCorrect).map((o) => o.letter)),
    [question]
  );

  const done = Object.keys(answers).length;
  const isLast = index === questions.length - 1;

  if (!question) return null;

  function toggle(letter: string) {
    if (committed || paused) return;
    setPicks((current) => {
      const mine = current[question.id] ?? [];
      /* A single-answer question REPLACES rather than accumulates —
         picking B after A means B, not "A and B". */
      if (question.kind === "qcu") {
        return { ...current, [question.id]: mine.includes(letter) ? [] : [letter] };
      }
      return {
        ...current,
        [question.id]: mine.includes(letter)
          ? mine.filter((l) => l !== letter)
          : [...mine, letter],
      };
    });
  }

  function confirm() {
    if (committed || selected.length === 0) return;
    onCommit(question, selected, Math.round((Date.now() - askedAt.current) / 1000), index);
    if (!instant) advance();
  }

  function advance() {
    if (isLast) return;
    setIndex((i) => i + 1);
  }

  /* Skipping records an empty answer on purpose: the analysis has to
     tell "left blank" apart from "never reached". */
  function skip() {
    if (!committed) {
      onCommit(question, [], Math.round((Date.now() - askedAt.current) / 1000), index);
    }
    isLast ? onFinish() : advance();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ================= the bar that stays ================= */}
      <div className="sticky top-0 z-20 -mx-md overflow-hidden border-b border-border-light bg-surface-light/90 px-md backdrop-blur-md md:-mx-xl md:px-xl">
        <div className="flex items-center gap-2 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-text-primary-light">{topicTitle}</p>
            <p className="num text-[11.5px] text-text-muted-light">
              {t.bank.questionOf} {index + 1} / {questions.length}
            </p>
          </div>

          <span className="num flex items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-text-secondary-light">
            <Clock size={12.5} />
            {clock(seconds)}
          </span>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t.bank.resume : t.bank.pause}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary-light transition hover:bg-black/[0.05] hover:text-primary"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setStripOpen((s) => !s)}
            aria-expanded={stripOpen}
            aria-label={stripOpen ? t.bank.hideStrip : t.bank.showStrip}
            className={
              "flex h-8 w-8 items-center justify-center rounded-full transition " +
              (stripOpen
                ? "bg-primary text-white"
                : "text-text-secondary-light hover:bg-black/[0.05] hover:text-primary")
            }
          >
            <LayoutGrid size={15} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (done === 0 || window.confirm(t.bank.quitConfirm)) onFinish();
            }}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary transition hover:bg-primary/15"
          >
            <Flag size={12.5} />
            <span className="hidden sm:inline">{t.bank.finish}</span>
          </button>
        </div>

        {/* How far through — the one number worth showing continuously. */}
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500 ease-out"
            style={{ width: `${(done / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ================= every question, as numbers ================= */}
      {stripOpen && (
        <div className="animate-rise-in rounded-2xl border border-border-light bg-surface-light p-3">
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {questions.map((q, i) => {
              const a = answers[q.id];
              const verdict = a ? verdictFor(a) : null;
              let tone = "bg-black/[0.05] text-text-secondary-light hover:bg-black/10";
              if (i === index) tone = "bg-primary text-white ring-2 ring-primary/30";
              else if (verdict && !instant) tone = "bg-primary/15 text-primary";
              else if (verdict === "right") tone = "bg-success/15 text-success";
              else if (verdict === "partial") tone = "bg-gold/20 text-gold";
              else if (verdict === "wrong") tone = "bg-error/15 text-error";
              else if (verdict === "skipped") tone = "bg-black/10 text-text-muted-light";

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setStripOpen(false);
                  }}
                  className={"num h-8 w-8 shrink-0 rounded-lg text-[11.5px] font-bold transition " + tone}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= paused ================= */}
      {paused ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border-light bg-surface-light px-5 py-16 text-center">
          <span className="flex h-14 w-14 animate-breathe items-center justify-center rounded-full bg-primary/10 text-primary">
            <Pause size={22} />
          </span>
          <p className="text-[15px] font-bold text-text-primary-light">{t.bank.paused}</p>
          <p className="text-[12.5px] text-text-secondary-light">{t.bank.pausedHint}</p>
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="mt-1 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-primary-hover"
          >
            <Play size={15} fill="currentColor" />
            {t.bank.resume}
          </button>
        </div>
      ) : (
        <>
          {/* ================= the question ================= */}
          <div
            key={question.id}
            className="animate-rise-in rounded-3xl border border-border-light bg-surface-light p-4 md:p-6"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-primary">
                {question.kind === "qcm" ? t.bank.qcm : t.bank.qcu}
              </span>
              <span className="text-[11.5px] text-text-muted-light">
                {question.kind === "qcm" ? t.bank.qcmHint : t.bank.qcuHint}
              </span>
              <span className="grow" />
              {question.tags.map((tag) => (
                <span
                  key={tag}
                  className="num rounded-full bg-black/[0.05] px-2.5 py-1 text-[10.5px] text-text-secondary-light"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p
              dir="auto"
              className="mt-3.5 text-[16px] font-semibold leading-[1.8] text-text-primary-light"
            >
              {question.statement}
            </p>

            {question.media.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-2">
                {question.media.map((src) => (
                  <a
                    key={src}
                    href={src}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="relative block h-32 w-44 overflow-hidden rounded-2xl border border-border-light bg-bg-light transition hover:border-primary/50"
                  >
                    {/* unoptimized: remote hosts the image optimizer is
                        not configured for, and a broken optimizer is a
                        broken question. */}
                    <Image src={src} alt="" fill sizes="176px" className="object-contain" unoptimized />
                  </a>
                ))}
              </div>
            )}

            <ul className="mt-4 flex flex-col gap-2">
              {question.options.map((option) => {
                const mine = selected.includes(option.letter);
                const correct = correctLetters.has(option.letter);

                let row = "border-border-light hover:border-primary/50 hover:bg-primary/[0.03]";
                let badge = "bg-black/[0.06] text-text-secondary-light";
                let glyph: React.ReactNode = option.letter;

                if (revealed) {
                  if (correct) {
                    row = "border-success/60 bg-success/[0.08]";
                    badge = "bg-success text-white";
                    glyph = <Check size={13} strokeWidth={3.2} />;
                  } else if (mine) {
                    row = "border-error/60 bg-error/[0.07]";
                    badge = "bg-error text-white";
                    glyph = <X size={13} strokeWidth={3.2} />;
                  } else {
                    row = "border-border-light opacity-55";
                  }
                } else if (mine) {
                  /* Selected, not yet judged. */
                  row = "border-primary bg-primary/[0.07] ring-1 ring-primary/25";
                  badge = "bg-primary text-white";
                }

                return (
                  <li key={option.letter}>
                    <button
                      type="button"
                      onClick={() => toggle(option.letter)}
                      disabled={committed}
                      aria-pressed={mine}
                      className={
                        "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-start transition " +
                        row
                      }
                    >
                      <span
                        className={
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold transition " +
                          badge
                        }
                      >
                        {glyph}
                      </span>
                      <span
                        dir="auto"
                        className="pt-0.5 text-[14px] leading-relaxed text-text-primary-light"
                      >
                        {option.body}
                      </span>

                      {/* A right answer they did not pick is the one thing
                          a correction has to point at. */}
                      {revealed && correct && !mine && (
                        <span className="ms-auto shrink-0 self-center rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                          {t.bank.correctAnswer}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* ---- the verdict ---- */}
            {revealed && answer && (
              <VerdictBanner verdict={verdictFor(answer)} />
            )}

            {/* ---- the part they learn from ---- */}
            {revealed && question.explanation && (
              <div className="animate-rise-in mt-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary">
                  <Lightbulb size={14} />
                  {t.bank.explanation}
                </p>
                <p
                  dir="auto"
                  className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.9] text-text-secondary-light"
                >
                  {question.explanation}
                </p>
              </div>
            )}
          </div>

          {/* ================= select, then confirm ================= */}
          <div className="sticky bottom-0 z-20 -mx-md border-t border-border-light bg-surface-light/90 px-md py-3 backdrop-blur-md md:-mx-xl md:px-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                aria-label={t.bank.prev}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-light text-text-secondary-light transition hover:border-primary/40 hover:text-primary disabled:opacity-35"
              >
                <ChevronRight size={17} className="rtl:rotate-180" />
              </button>

              {committed ? (
                <button
                  type="button"
                  onClick={() => (isLast ? onFinish() : advance())}
                  className="flex h-11 grow items-center justify-center gap-2 rounded-2xl bg-primary text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99]"
                >
                  {isLast ? t.bank.finish : t.bank.next}
                  {isLast ? <Flag size={15} /> : <ChevronLeft size={16} className="rtl:rotate-180" />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={selected.length === 0}
                  className="flex h-11 grow items-center justify-center gap-2 rounded-2xl bg-primary text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99] disabled:bg-black/[0.07] disabled:text-text-muted-light disabled:shadow-none"
                >
                  <Check size={16} strokeWidth={3} />
                  {selected.length === 0 ? t.bank.pickFirst : t.bank.confirm}
                </button>
              )}

              {!committed && (
                <button
                  type="button"
                  onClick={skip}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-border-light px-3.5 text-[12.5px] text-text-muted-light transition hover:border-primary/40 hover:text-primary"
                >
                  <Minus size={13} />
                  {t.bank.skip}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function VerdictBanner({ verdict }: { verdict: ReturnType<typeof verdictFor> }) {
  const { t } = useI18n();

  const look = {
    right: { bg: "bg-success/10 text-success", icon: <Check size={15} strokeWidth={3} />, label: t.bank.right, hint: null },
    wrong: { bg: "bg-error/10 text-error", icon: <X size={15} strokeWidth={3} />, label: t.bank.wrong, hint: null },
    partial: { bg: "bg-gold/15 text-gold", icon: <Minus size={15} strokeWidth={3} />, label: t.bank.partial, hint: t.bank.partialHint },
    skipped: { bg: "bg-black/[0.06] text-text-muted-light", icon: <Minus size={15} />, label: t.bank.skipped, hint: null },
  }[verdict];

  return (
    <div className={"animate-rise-in mt-3.5 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 " + look.bg}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.06]">
        {look.icon}
      </span>
      <span className="text-[13.5px] font-bold">{look.label}</span>
      {look.hint && <span className="text-[12px] opacity-80">{look.hint}</span>}
    </div>
  );
}
