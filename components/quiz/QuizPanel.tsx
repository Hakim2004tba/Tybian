"use client";

import { useMemo, useState } from "react";
import { Check, X, Lightbulb, RotateCcw, GraduationCap, Dumbbell, Trophy } from "lucide-react";
import { submitQuizAction } from "@/lib/actions/quiz";
import type { Correction } from "@/lib/data/quiz";
import type { StudentQuestion } from "@/lib/data/quiz";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** A, B, C… beside each proposition, the way a QCM paper is written. */
const LETTERS = "ABCDEFGH".split("");

type Mode = "training" | "exam";

export function QuizPanel({
  lessonId,
  questions,
  previousBest,
}: {
  lessonId: string;
  questions: StudentQuestion[];
  previousBest: number | null;
}) {
  const { t: T } = useI18n();
  const t = T.quiz;

  const [mode, setMode] = useState<Mode>("training");
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const answeredCount = useMemo(
    () => questions.filter((q) => (chosen[q.id] ?? []).length > 0).length,
    [chosen, questions]
  );

  function toggle(q: StudentQuestion, optionId: string) {
    // Locked once its correction is on screen.
    if (correction || revealed.has(q.id)) return;

    setChosen((prev) => {
      const current = prev[q.id] ?? [];
      /*
        A QCU replaces; a QCM accumulates. Radio behaviour is enforced
        here as well as in the markup, because the grader refuses a QCU
        that arrives with two ticks and the student should never be able
        to build one by accident.
      */
      if (q.kind === "qcu") return { ...prev, [q.id]: [optionId] };
      return {
        ...prev,
        [q.id]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  }

  async function submitAll() {
    setPending(true);
    const result = await submitQuizAction(lessonId, mode, chosen);
    setPending(false);
    if (result.ok) setCorrection(result.correction);
  }

  /**
   * Training mode corrects one question at a time.
   *
   * It submits the WHOLE set each time so the server stays the only
   * grader — the browser never learns an answer it has not earned. The
   * cost is one round trip per question, which is the right trade for
   * not shipping the answer key to the page.
   */
  async function revealOne(questionId: string) {
    setPending(true);
    const result = await submitQuizAction(lessonId, "training", chosen, questionId);
    setPending(false);
    if (result.ok) {
      /*
        Merge, never replace: each reveal returns the key to one
        question only, so overwriting would throw away the corrections
        already on screen.
      */
      setCorrection((prev) =>
        prev
          ? {
              ...result.correction,
              keys: { ...prev.keys, ...result.correction.keys },
              verdicts: [
                ...prev.verdicts.filter((v) => v.questionId !== questionId),
                ...result.correction.verdicts,
              ],
            }
          : result.correction
      );
      setRevealed((prev) => new Set(prev).add(questionId));
    }
  }

  function restart() {
    setChosen({});
    setCorrection(null);
    setRevealed(new Set());
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-border-dark bg-surface-dark px-lg py-10 text-center">
        <GraduationCap size={26} className="mx-auto text-text-muted-dark" strokeWidth={1.5} />
        <p className="mt-3 text-[13.5px] text-text-muted-dark">{t.empty}</p>
      </div>
    );
  }

  const done = correction !== null && revealed.size === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Mode switch + progress */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-border-dark p-0.5 text-[12.5px]">
          {(["training", "exam"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                restart();
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                mode === m ? "bg-primary text-white" : "text-text-muted-dark hover:text-text-primary-dark"
              )}
            >
              {m === "training" ? <Dumbbell size={13} /> : <GraduationCap size={13} />}
              {m === "training" ? t.modeTraining : t.modeExam}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[12.5px] text-text-muted-dark">
          {previousBest !== null && (
            <span className="flex items-center gap-1.5">
              <Trophy size={13} className="text-gold" />
              {t.bestScore} <span className="num font-semibold text-text-primary-dark">{previousBest}%</span>
            </span>
          )}
          <span className="num">
            {answeredCount} / {questions.length}
          </span>
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-text-muted-dark">
        {mode === "training" ? t.hintTraining : t.hintExam}
      </p>

      {/* Score banner, once the whole set is graded */}
      {done && correction && (
        <div
          className={cn(
            "rounded-xl border p-4 text-center",
            correction.scorePct >= 50
              ? "border-success/30 bg-success/10"
              : "border-error/30 bg-error/10"
          )}
        >
          <p className="num text-[30px] font-bold leading-none text-text-primary-dark">
            {correction.scorePct}%
          </p>
          <p className="mt-1.5 text-[13px] text-text-secondary-dark">
            <span className="num">{correction.correctCount}</span> / <span className="num">{correction.total}</span>{" "}
            {t.correctOf}
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"
          >
            <RotateCcw size={14} />
            {t.retry}
          </button>
        </div>
      )}

      {/* Questions */}
      <ol className="flex flex-col gap-4">
        {questions.map((q, qi) => {
          const verdict = correction?.verdicts.find((v) => v.questionId === q.id);
          const key = correction?.keys[q.id];
          const showCorrection =
            correction !== null && (mode === "exam" || revealed.has(q.id) || revealed.size === 0);
          const picked = chosen[q.id] ?? [];

          return (
            <li key={q.id} className="rounded-xl border border-border-dark bg-surface-dark p-4">
              <div className="flex items-start gap-2.5">
                <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-bold text-primary">
                  {qi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-relaxed text-text-primary-dark">{q.stem}</p>
                  <span className="mt-1 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10.5px] text-text-muted-dark">
                    {q.kind === "qcu" ? t.qcu : t.qcm}
                  </span>
                </div>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5">
                {q.options.map((o, oi) => {
                  const isPicked = picked.includes(o.id);
                  const isKey = showCorrection && key?.correctOptionIds.includes(o.id);
                  const isWrongPick = showCorrection && isPicked && !isKey;

                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => toggle(q, o.id)}
                        disabled={showCorrection}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-start text-[13.5px] transition-colors",
                          isKey && "border-success/50 bg-success/10 text-text-primary-dark",
                          isWrongPick && "border-error/50 bg-error/10 text-text-primary-dark",
                          !showCorrection && isPicked && "border-primary bg-primary/10 text-text-primary-dark",
                          !showCorrection && !isPicked && "border-border-dark text-text-secondary-dark hover:border-primary/50"
                        )}
                      >
                        <span
                          className={cn(
                            "num mt-px flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold",
                            q.kind === "qcu" ? "rounded-full" : "rounded",
                            isKey
                              ? "bg-success text-white"
                              : isWrongPick
                                ? "bg-error text-white"
                                : isPicked
                                  ? "bg-primary text-white"
                                  : "border border-border-dark text-text-muted-dark"
                          )}
                        >
                          {isKey ? <Check size={12} /> : isWrongPick ? <X size={12} /> : LETTERS[oi]}
                        </span>
                        <span className="min-w-0 flex-1">{o.body}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Training: correct this one question now */}
              {mode === "training" && !showCorrection && picked.length > 0 && (
                <button
                  type="button"
                  onClick={() => revealOne(q.id)}
                  disabled={pending}
                  className="mt-3 text-[12.5px] font-semibold text-primary disabled:opacity-50"
                >
                  {t.checkThis}
                </button>
              )}

              {showCorrection && verdict && (
                <div className="mt-3 border-t border-border-dark pt-3">
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-[12.5px] font-semibold",
                      verdict.isCorrect ? "text-success" : "text-error"
                    )}
                  >
                    {verdict.isCorrect ? <Check size={13} /> : <X size={13} />}
                    {verdict.isCorrect ? t.right : t.wrong}
                  </p>

                  {key?.explanation && (
                    <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-text-secondary-dark">
                      <Lightbulb size={13} className="mt-0.5 shrink-0 text-gold" />
                      {key.explanation}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {mode === "exam" && !correction && (
        <button
          type="button"
          onClick={submitAll}
          disabled={pending || answeredCount === 0}
          className="self-start rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? t.grading : t.submit}
        </button>
      )}
    </div>
  );
}
