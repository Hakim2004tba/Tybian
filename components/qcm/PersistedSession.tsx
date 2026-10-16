"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BankQuestion } from "@/lib/data/qcm-bank";
import type { SessionDetail } from "@/lib/data/qcm-sessions";
import { saveAnswerAction, finishSessionAction } from "@/lib/actions/qcm-sessions";
import { QcmRunner } from "@/components/qcm/QcmRunner";
import { QcmAnalysis } from "@/components/qcm/QcmAnalysis";
import type { Answered } from "@/components/qcm/QcmSession";

/**
 * A session that lives in the database.
 *
 * The in-memory QcmSession still exists for a quick unsaved run; this
 * is the one the hub links to. The difference that matters is WHERE
 * THE ANSWERS GO: every commit is written server-side as it happens,
 * so closing the tab mid-session loses nothing and "continue" has
 * something to continue from.
 *
 * Writes are fire-and-forget on purpose — the correction is already on
 * screen by the time the request leaves, and making the student wait
 * for a round trip per question would be felt on every single one.
 */
export function PersistedSession({
  detail,
  questions,
  startOnAnalysis,
}: {
  detail: SessionDetail;
  questions: BankQuestion[];
  startOnAnalysis: boolean;
}) {
  const router = useRouter();

  const initial = useMemo(() => {
    const map: Record<string, Answered> = {};
    questions.forEach((q, i) => {
      const saved = detail.answers[q.id];
      if (!saved) return;
      map[q.id] = {
        questionId: q.id,
        chosen: saved.chosen,
        correct: q.options.filter((o) => o.isCorrect).map((o) => o.letter),
        seconds: saved.seconds,
        order: i,
      };
    });
    return map;
  }, [questions, detail.answers]);

  const [answers, setAnswers] = useState<Record<string, Answered>>(initial);
  const [phase, setPhase] = useState<"running" | "analysis">(
    startOnAnalysis || detail.finished ? "analysis" : "running"
  );

  /* Only used to show elapsed time on the analysis screen; the per
     question seconds are what actually get stored. */
  const openedAt = useRef(Date.now());

  const commit = useCallback(
    (question: BankQuestion, chosen: string[], seconds: number, order: number) => {
      setAnswers((cur) => ({
        ...cur,
        [question.id]: {
          questionId: question.id,
          chosen,
          correct: question.options.filter((o) => o.isCorrect).map((o) => o.letter),
          seconds,
          order,
        },
      }));
      void saveAnswerAction(detail.id, question.id, chosen, seconds, order + 1);
    },
    [detail.id]
  );

  const finish = useCallback(() => {
    void finishSessionAction(detail.id);
    setPhase("analysis");
  }, [detail.id]);

  const spent = useMemo(
    () => Object.values(answers).reduce((n, a) => n + Math.max(0, a.seconds), 0),
    [answers]
  );

  if (questions.length === 0) {
    return (
      <p className="rounded-2xl border border-border-light bg-surface-light px-4 py-14 text-center text-[14px] text-text-secondary-light">
        —
      </p>
    );
  }

  if (phase === "analysis") {
    return (
      <QcmAnalysis
        questions={questions}
        answers={answers}
        elapsedSeconds={spent || Math.round((Date.now() - openedAt.current) / 1000)}
        subjectHref="/dashboard/qcm"
        onRestart={() => router.push("/dashboard/qcm")}
        /* Reviewing a finished session must not silently start a new
           one, so there is no "redo the missed ones" shortcut here —
           that belongs to the hub, where restarting is explicit. */
      />
    );
  }

  return (
    <QcmRunner
      questions={questions}
      topicTitle={detail.title}
      instant={detail.mode === "instant"}
      answers={answers}
      onCommit={commit}
      onFinish={finish}
      subjectHref="/dashboard/qcm"
      startAt={Math.min(detail.cursorAt, questions.length - 1)}
    />
  );
}
