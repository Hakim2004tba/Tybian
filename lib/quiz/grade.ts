/**
 * QCM grading. Pure and dependency-free so it can be unit-tested
 * without a database — marks, like money, are worth testing directly
 * (tests/quiz-grade.test.ts).
 */

export type GradedQuestion = {
  questionId: string;
  correctOptionIds: string[];
  chosenOptionIds: string[];
};

export type QuestionVerdict = {
  questionId: string;
  isCorrect: boolean;
  /** Correct propositions the student ticked. */
  hit: string[];
  /** Correct propositions the student missed. */
  missed: string[];
  /** Wrong propositions the student ticked. */
  wrong: string[];
};

/**
 * All-or-nothing, as the faculties grade it.
 *
 * A question counts only when the chosen set is EXACTLY the correct
 * set: every correct proposition ticked, no incorrect one ticked.
 * Naming four of five correct propositions is not four fifths of a
 * right answer in a medical QCM — it is a wrong one, and a platform
 * that awarded partial credit would be training students for an exam
 * that does not exist.
 *
 * The breakdown is still returned, because "you missed proposition C"
 * is the sentence a student actually learns from.
 */
export function gradeQuestion(q: GradedQuestion): QuestionVerdict {
  const correct = new Set(q.correctOptionIds);
  const chosen = new Set(q.chosenOptionIds);

  const hit = q.correctOptionIds.filter((id) => chosen.has(id));
  const missed = q.correctOptionIds.filter((id) => !chosen.has(id));
  const wrong = q.chosenOptionIds.filter((id) => !correct.has(id));

  return {
    questionId: q.questionId,
    /*
      An empty answer never scores, even against a question whose
      correct set is somehow empty — two empty sets happen to "match",
      and without this guard a blank submission would be marked right.
    */
    isCorrect: missed.length === 0 && wrong.length === 0 && hit.length > 0,
    hit,
    missed,
    wrong,
  };
}

export type AttemptResult = {
  verdicts: QuestionVerdict[];
  correctCount: number;
  total: number;
  /** Whole percent, rounded. */
  scorePct: number;
};

export function gradeAttempt(questions: GradedQuestion[]): AttemptResult {
  const verdicts = questions.map(gradeQuestion);
  const correctCount = verdicts.filter((v) => v.isCorrect).length;
  const total = questions.length;
  return {
    verdicts,
    correctCount,
    total,
    scorePct: total === 0 ? 0 : Math.round((correctCount / total) * 100),
  };
}
