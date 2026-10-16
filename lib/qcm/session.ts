/**
 * What a practice session is worth, once it is over.
 *
 * Pure, because this is the screen a student judges their revision by
 * and "you scored 62%" must be arithmetic, not a guess.
 * Tested in tests/qcm-session.test.ts.
 */

export type Graded = {
  questionId: string;
  /** Letters the student committed to. */
  chosen: string[];
  /** Letters that were actually right. */
  correct: string[];
  seconds: number;
};

export type Verdict = "right" | "wrong" | "partial" | "skipped";

export function verdictFor(answer: Graded): Verdict {
  if (answer.chosen.length === 0) return "skipped";

  const want = new Set(answer.correct);
  const got = new Set(answer.chosen);

  const hits = [...got].filter((l) => want.has(l)).length;
  const misses = [...got].filter((l) => !want.has(l)).length;

  if (hits === want.size && misses === 0) return "right";

  /*
    PARTIAL IS ITS OWN VERDICT, not a kind of wrong.

    On a multi-answer question, picking two of three correct letters and
    nothing wrong is most of the way there, and a student told only
    "wrong" learns nothing about which half they had. It still does not
    count toward the score — the exam would not give it — but it is
    shown differently.
  */
  if (hits > 0 && misses === 0) return "partial";
  return "wrong";
}

export type SessionSummary = {
  total: number;
  answered: number;
  right: number;
  partial: number;
  wrong: number;
  skipped: number;
  /** Whole percent of the WHOLE set, not of what was answered. */
  percent: number;
  totalSeconds: number;
  /** Seconds per answered question, rounded. */
  averageSeconds: number;
};

export function summarise(answers: Graded[], total: number): SessionSummary {
  let right = 0;
  let partial = 0;
  let wrong = 0;
  let seconds = 0;
  let answered = 0;

  for (const answer of answers) {
    seconds += Math.max(0, answer.seconds);
    const verdict = verdictFor(answer);
    if (verdict === "skipped") continue;
    answered++;
    if (verdict === "right") right++;
    else if (verdict === "partial") partial++;
    else wrong++;
  }

  /*
    Scored over the WHOLE set. Scoring over what was answered lets a
    student answer the three they know, skip the rest, and be told they
    scored 100% — the opposite of what a revision tool is for.
  */
  return {
    total,
    answered,
    right,
    partial,
    wrong,
    skipped: Math.max(0, total - answered),
    percent: total > 0 ? Math.round((right / total) * 100) : 0,
    totalSeconds: seconds,
    averageSeconds: answered > 0 ? Math.round(seconds / answered) : 0,
  };
}

/** "12:05" from seconds — minutes may pass 60 and still read correctly. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Headline shown on the analysis screen, keyed by score. */
export function gradeBand(percent: number): "excellent" | "good" | "fair" | "weak" {
  if (percent >= 80) return "excellent";
  if (percent >= 60) return "good";
  if (percent >= 40) return "fair";
  return "weak";
}
