"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { recordAnswerAction } from "@/lib/actions/qcm-bank";
import type { BankQuestion } from "@/lib/data/qcm-bank";
import type { Graded } from "@/lib/qcm/session";
import { QcmSetup, type SessionConfig } from "@/components/qcm/QcmSetup";
import { QcmRunner } from "@/components/qcm/QcmRunner";
import { QcmAnalysis } from "@/components/qcm/QcmAnalysis";

/**
 * A practice session, from the setup card to the analysis screen.
 *
 * THE THREE PHASES LIVE HERE, in one component, because the answers
 * have to outlive the runner. The analysis screen is not a new page —
 * it reads the same answers the student just gave, and a route change
 * would throw them away. So the runner and the analysis are two views
 * of state held one level above both.
 *
 * EVERY ANSWER IS SELECT-THEN-CONFIRM, including a single-answer QCU.
 * It used to commit on the first tap, which is faster and worse: a
 * mis-tap on a phone was instantly a permanent wrong answer, with no
 * way back. One deliberate confirm costs a tap and removes a whole
 * class of answers the student never meant to give.
 */

export type Phase = "setup" | "running" | "analysis";

export type Answered = Graded & { /** Where it sat in this session. */ order: number };

export function QcmSession({
  questions,
  topicTitle,
  subjectHref,
}: {
  questions: BankQuestion[];
  topicTitle: string;
  subjectHref: string;
}) {
  const { t } = useI18n();

  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [set, setSet] = useState<BankQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answered>>({});

  /*
    A ref, not state. Re-rendering on every tick of a stopwatch would
    re-render the question and its options sixty times a minute for a
    number nobody reads mid-question. The runner owns the visible
    clock; this is only here so a committed answer can be stamped with
    how long it took.
  */
  const startedAt = useRef<number>(0);

  const begin = useCallback(
    (chosen: SessionConfig) => {
      let pool = [...questions];

      if (chosen.shuffle) {
        /* Fisher-Yates. `sort(() => Math.random() - 0.5)` is the
           familiar one-liner and is not a shuffle — it biases heavily
           toward the original order. */
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }
      if (chosen.count > 0) pool = pool.slice(0, chosen.count);

      setConfig(chosen);
      setSet(pool);
      setAnswers({});
      startedAt.current = Date.now();
      setPhase("running");
    },
    [questions]
  );

  const commit = useCallback(
    (question: BankQuestion, chosen: string[], seconds: number, order: number) => {
      setAnswers((current) => ({
        ...current,
        [question.id]: {
          questionId: question.id,
          chosen,
          correct: question.options.filter((o) => o.isCorrect).map((o) => o.letter),
          seconds,
          order,
        },
      }));

      /* History is written in the background: the correction is
         already on screen, and a slow write must never hold the next
         question. See recordAnswerAction. */
      void recordAnswerAction(question.id, chosen);
    },
    []
  );

  const finish = useCallback(() => setPhase("analysis"), []);

  /** Only the ones they got wrong or part-right, in session order. */
  const missed = useMemo(() => {
    const byId = new Map(set.map((q) => [q.id, q]));
    return Object.values(answers)
      .filter((a) => {
        if (a.chosen.length === 0) return true;
        const want = new Set(a.correct);
        const got = new Set(a.chosen);
        return got.size !== want.size || [...want].some((l) => !got.has(l));
      })
      .sort((a, b) => a.order - b.order)
      .map((a) => byId.get(a.questionId))
      .filter((q): q is BankQuestion => Boolean(q));
  }, [answers, set]);

  if (questions.length === 0) {
    return (
      <p className="rounded-2xl border border-border-light bg-surface-light px-4 py-14 text-center text-[14px] text-text-secondary-light">
        {t.bank.empty}
      </p>
    );
  }

  if (phase === "setup" || !config) {
    return <QcmSetup total={questions.length} onStart={begin} />;
  }

  if (phase === "analysis") {
    return (
      <QcmAnalysis
        questions={set}
        answers={answers}
        elapsedSeconds={Math.round((Date.now() - startedAt.current) / 1000)}
        subjectHref={subjectHref}
        onRestart={() => setPhase("setup")}
        /* Redoing only the missed ones is a NEW session over a smaller
           set, not a filter on this one — the score has to be out of
           what was actually attempted the second time. */
        onRetryMissed={
          missed.length > 0
            ? () => {
                setSet(missed);
                setAnswers({});
                startedAt.current = Date.now();
                setPhase("running");
              }
            : undefined
        }
      />
    );
  }

  return (
    <QcmRunner
      key={set.map((q) => q.id).join(":")}
      questions={set}
      topicTitle={topicTitle}
      instant={config.mode === "instant"}
      answers={answers}
      onCommit={commit}
      onFinish={finish}
      subjectHref={subjectHref}
    />
  );
}
