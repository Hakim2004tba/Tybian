import "server-only";
import { query, queryOne, execute, newId, type SqlValue } from "@/lib/db";
import { gradeAttempt, type GradedQuestion, type QuestionVerdict } from "@/lib/quiz/grade";
import { tablesExist, QUIZ_TABLES } from "@/lib/db/tables";

/**
 * The QCM attached to a lesson.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: a student must never
 * receive `is_correct` or `explanation` before they have answered.
 * Those columns are the answer key. A page that fetched the whole
 * question row and merely hid the key in the markup would be handing
 * it over — it travels in the server-rendered payload, and reading it
 * takes one glance at the page source. So the student-facing query
 * below SELECTS the key out entirely, and grading happens here on the
 * server, never in the browser.
 */

export type StudentOption = { id: string; body: string };

export type StudentQuestion = {
  id: string;
  kind: "qcm" | "qcu";
  stem: string;
  options: StudentOption[];
};

/** Questions as the student may see them — no answer key. */
export async function getQuizForStudent(lessonId: string): Promise<StudentQuestion[]> {
  if (!(await tablesExist(QUIZ_TABLES))) return [];

  const questions = await query<{ id: string; kind: "qcm" | "qcu"; stem: string }>(
    `SELECT id, kind, stem
       FROM lesson_questions
      WHERE lesson_id = ? AND deleted_at IS NULL
      ORDER BY position ASC, created_at ASC`,
    [lessonId]
  );
  if (questions.length === 0) return [];

  const ids = questions.map((q) => q.id);
  const options = await query<{ id: string; question_id: string; body: string }>(
    `SELECT id, question_id, body
       FROM lesson_question_options
      WHERE question_id IN (${ids.map(() => "?").join(",")})
      ORDER BY position ASC`,
    ids
  );

  return questions.map((q) => ({
    ...q,
    options: options.filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, body: o.body })),
  }));
}

/** The full rows, for the teacher's editor and for grading. */
export type AdminOption = StudentOption & { isCorrect: boolean };

export type AdminQuestion = {
  id: string;
  kind: "qcm" | "qcu";
  stem: string;
  explanation: string | null;
  options: AdminOption[];
};

export async function getQuizForAdmin(lessonId: string): Promise<AdminQuestion[]> {
  if (!(await tablesExist(QUIZ_TABLES))) return [];

  const questions = await query<{
    id: string;
    kind: "qcm" | "qcu";
    stem: string;
    explanation: string | null;
  }>(
    `SELECT id, kind, stem, explanation
       FROM lesson_questions
      WHERE lesson_id = ? AND deleted_at IS NULL
      ORDER BY position ASC, created_at ASC`,
    [lessonId]
  );
  if (questions.length === 0) return [];

  const ids = questions.map((q) => q.id);
  const options = await query<{
    id: string;
    question_id: string;
    body: string;
    is_correct: number;
  }>(
    `SELECT id, question_id, body, is_correct
       FROM lesson_question_options
      WHERE question_id IN (${ids.map(() => "?").join(",")})
      ORDER BY position ASC`,
    ids
  );

  return questions.map((q) => ({
    ...q,
    options: options
      .filter((o) => o.question_id === q.id)
      .map((o) => ({ id: o.id, body: o.body, isCorrect: o.is_correct === 1 })),
  }));
}

export type Correction = {
  verdicts: QuestionVerdict[];
  correctCount: number;
  total: number;
  scorePct: number;
  /** Per question: the key and the teacher's justification. */
  keys: Record<string, { correctOptionIds: string[]; explanation: string | null }>;
};

/**
 * Grades a submission and records the attempt.
 *
 * `chosen` comes from the browser and is treated as untrusted input: it
 * is intersected with the options that genuinely belong to this
 * lesson's questions before anything is counted. Without that, a
 * crafted submission could name option ids from another lesson — or
 * ids that do not exist — and walk away with a score.
 */
export async function submitAttempt(
  userId: string,
  lessonId: string,
  mode: "training" | "exam",
  chosen: Record<string, string[]>
): Promise<Correction> {
  const full = await getQuizForAdmin(lessonId);

  const graded: GradedQuestion[] = full.map((q) => {
    const valid = new Set(q.options.map((o) => o.id));
    const picked = (chosen[q.id] ?? []).filter((id) => valid.has(id));

    /*
      A QCU has one answer by definition. If a client sends several,
      the submission is not silently "fixed" into the first one — it is
      treated as no answer, because guessing which tick the student
      meant would invent an answer on their behalf.
    */
    const chosenIds = q.kind === "qcu" && picked.length > 1 ? [] : picked;

    return {
      questionId: q.id,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      chosenOptionIds: chosenIds,
    };
  });

  const result = gradeAttempt(graded);

  const attemptId = newId();
  await execute(
    `INSERT INTO lesson_quiz_attempts
       (id, user_id, lesson_id, mode, total_questions, correct_count, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [attemptId, userId, lessonId, mode, result.total, result.correctCount]
  );

  /*
    ONE statement, not one per chosen option.

    A twenty-question QCM where the student ticks two boxes each used to
    be forty sequential INSERTs — forty round trips, each holding one of
    the pool's five connections, for a single "submit". Two students
    finishing at the same moment could occupy the entire pool between
    them while every other page on the site waited.

    Rows are built in the same order and with the same values; only the
    number of trips to the database changes.
  */
  const choiceRows: SqlValue[] = [];
  let choiceCount = 0;
  for (const g of graded) {
    for (const optionId of g.chosenOptionIds) {
      choiceRows.push(newId(), attemptId, g.questionId, optionId);
      choiceCount++;
    }
  }

  if (choiceCount > 0) {
    const placeholders = Array.from({ length: choiceCount }, () => "(?, ?, ?, ?)").join(", ");
    await execute(
      `INSERT INTO lesson_quiz_choices (id, attempt_id, question_id, option_id)
       VALUES ${placeholders}`,
      choiceRows
    );
  }

  const keys: Correction["keys"] = {};
  for (const q of full) {
    keys[q.id] = {
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      explanation: q.explanation,
    };
  }

  return { ...result, keys };
}

export type AttemptSummary = {
  id: string;
  mode: "training" | "exam";
  total_questions: number;
  correct_count: number;
  submitted_at: string;
};

export async function listAttempts(userId: string, lessonId: string): Promise<AttemptSummary[]> {
  if (!(await tablesExist(QUIZ_TABLES))) return [];

  return query<AttemptSummary>(
    `SELECT id, mode, total_questions, correct_count, submitted_at
       FROM lesson_quiz_attempts
      WHERE user_id = ? AND lesson_id = ? AND submitted_at IS NOT NULL
      ORDER BY submitted_at DESC
      LIMIT 10`,
    [userId, lessonId]
  );
}

/**
 * How the class did on each proposition — the teacher's view.
 *
 * Counting ticks per PROPOSITION, not just per question, is what turns
 * a quiz into feedback on the teaching: "thirty of forty picked C" says
 * precisely which misconception the lesson left behind.
 */
export type OptionStat = {
  question_id: string;
  option_id: string;
  body: string;
  is_correct: number;
  picks: number;
};

export async function optionStats(lessonId: string): Promise<OptionStat[]> {
  if (!(await tablesExist(QUIZ_TABLES))) return [];

  return query<OptionStat>(
    `SELECT o.question_id, o.id AS option_id, o.body, o.is_correct,
            COUNT(c.id) AS picks
       FROM lesson_question_options o
       JOIN lesson_questions q ON q.id = o.question_id
       LEFT JOIN lesson_quiz_choices c ON c.option_id = o.id
      WHERE q.lesson_id = ? AND q.deleted_at IS NULL
      GROUP BY o.question_id, o.id, o.body, o.is_correct
      ORDER BY o.question_id, o.position`,
    [lessonId]
  );
}

export async function quizReady(): Promise<boolean> {
  return tablesExist(QUIZ_TABLES);
}

export async function countQuestions(lessonId: string): Promise<number> {
  if (!(await tablesExist(QUIZ_TABLES))) return 0;

  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM lesson_questions WHERE lesson_id = ? AND deleted_at IS NULL`,
    [lessonId]
  );
  return Number(row?.n ?? 0);
}
