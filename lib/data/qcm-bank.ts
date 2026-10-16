import "server-only";
import { query, queryOne } from "@/lib/db";
import { tablesExist } from "@/lib/db/tables";

export const QCM_BANK_TABLES = ["qcm_subjects", "qcm_topics", "qcm_questions", "qcm_options"];

export async function bankReady(): Promise<boolean> {
  return tablesExist(QCM_BANK_TABLES);
}

export type BankSubject = {
  id: string;
  name: string;
  slug: string;
  /** False means "coming soon": shown, not openable. */
  isActive: boolean;
  topicCount: number;
  questionCount: number;
};

export async function listSubjects(): Promise<BankSubject[]> {
  if (!(await bankReady())) return [];

  const rows = await query<{
    id: string; name: string; slug: string; is_active: number;
    topic_count: number; question_count: number;
  }>(
    `SELECT s.id, s.name, s.slug, s.is_active,
            (SELECT COUNT(*) FROM qcm_topics t WHERE t.subject_id = s.id) AS topic_count,
            (SELECT COUNT(*) FROM qcm_questions q
               JOIN qcm_topics t2 ON t2.id = q.topic_id
              WHERE t2.subject_id = s.id AND q.deleted_at IS NULL) AS question_count
       FROM qcm_subjects s
      ORDER BY s.is_active DESC, s.sort_order, s.name`
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    isActive: Number(r.is_active) === 1,
    topicCount: Number(r.topic_count),
    questionCount: Number(r.question_count),
  }));
}

export type BankTopic = {
  id: string;
  title: string;
  slug: string;
  questionCount: number;
  /** How many of them this student has answered correctly at least once. */
  masteredCount: number;
};

export async function subjectBySlug(slug: string) {
  if (!(await bankReady())) return null;
  return queryOne<{ id: string; name: string; slug: string; is_active: number }>(
    `SELECT id, name, slug, is_active FROM qcm_subjects WHERE slug = ? LIMIT 1`,
    [slug]
  );
}

export async function listTopics(subjectId: string, userId: string): Promise<BankTopic[]> {
  if (!(await bankReady())) return [];

  const rows = await query<{
    id: string; title: string; slug: string; question_count: number; mastered: number;
  }>(
    `SELECT t.id, t.title, t.slug,
            (SELECT COUNT(*) FROM qcm_questions q
              WHERE q.topic_id = t.id AND q.deleted_at IS NULL) AS question_count,
            (SELECT COUNT(DISTINCT a.question_id)
               FROM qcm_answers a
               JOIN qcm_questions q2 ON q2.id = a.question_id
              WHERE q2.topic_id = t.id AND a.user_id = ? AND a.is_correct = 1) AS mastered
       FROM qcm_topics t
      WHERE t.subject_id = ?
      ORDER BY t.sort_order, t.title`,
    [userId, subjectId]
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    questionCount: Number(r.question_count),
    masteredCount: Number(r.mastered),
  }));
}

export type BankQuestion = {
  id: string;
  kind: "qcu" | "qcm";
  statement: string;
  explanation: string | null;
  media: string[];
  tags: string[];
  options: { letter: string; body: string; isCorrect: boolean }[];
};

/**
 * One topic's questions, with their options and answers.
 *
 * THE CORRECT ANSWERS TRAVEL TO THE BROWSER, on purpose. This is
 * practice, not an exam: the student sees the answer the moment they
 * commit to one, so hiding it behind a round trip per question would
 * add a wait to every single question for no secret worth keeping.
 * The graded, server-checked path is the existing lesson quiz.
 */
export async function topicQuestions(topicId: string): Promise<BankQuestion[]> {
  if (!(await bankReady())) return [];

  const rows = await query<{
    id: string; kind: "qcu" | "qcm"; statement: string;
    explanation: string | null; media: unknown; tags: unknown;
  }>(
    `SELECT id, kind, statement, explanation, media, tags
       FROM qcm_questions
      WHERE topic_id = ? AND deleted_at IS NULL
      ORDER BY sort_order, id`,
    [topicId]
  );
  if (rows.length === 0) return [];

  const options = await query<{
    question_id: string; letter: string; body: string; is_correct: number;
  }>(
    `SELECT o.question_id, o.letter, o.body, o.is_correct
       FROM qcm_options o
       JOIN qcm_questions q ON q.id = o.question_id
      WHERE q.topic_id = ? AND q.deleted_at IS NULL
      ORDER BY o.position, o.letter`,
    [topicId]
  );

  /* mysql2 returns a JSON column already parsed on some versions and
     as a string on others; accepting both is cheaper than pinning a
     driver version. */
  const asArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    statement: r.statement,
    explanation: r.explanation,
    media: asArray(r.media),
    tags: asArray(r.tags),
    options: options
      .filter((o) => o.question_id === r.id)
      .map((o) => ({ letter: o.letter, body: o.body, isCorrect: Number(o.is_correct) === 1 })),
  }));
}

export async function topicBySlug(subjectId: string, slug: string) {
  if (!(await bankReady())) return null;
  return queryOne<{ id: string; title: string }>(
    `SELECT id, title FROM qcm_topics WHERE subject_id = ? AND slug = ? LIMIT 1`,
    [subjectId, slug]
  );
}

/**
 * Questions by id, returned in the EXACT order the ids were given.
 *
 * A session freezes its order at creation; `WHERE id IN (...)` returns
 * rows in whatever order the engine likes, so the ids drive the sort
 * here rather than the query. Without that, "question 7 of 20" lands
 * on a different question every time the session is reopened.
 */
export async function topicQuestionsByIds(ids: string[]): Promise<BankQuestion[]> {
  if (!(await bankReady())) return [];
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const marks = unique.map(() => "?").join(",");

  const rows = await query<{
    id: string; kind: "qcu" | "qcm"; statement: string;
    explanation: string | null; media: unknown; tags: unknown;
  }>(
    `SELECT id, kind, statement, explanation, media, tags
       FROM qcm_questions
      WHERE id IN (${marks}) AND deleted_at IS NULL`,
    unique
  );
  if (rows.length === 0) return [];

  const options = await query<{
    question_id: string; letter: string; body: string; is_correct: number;
  }>(
    `SELECT question_id, letter, body, is_correct
       FROM qcm_options
      WHERE question_id IN (${marks})
      ORDER BY position, letter`,
    unique
  );

  const asArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const byId = new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        kind: r.kind,
        statement: r.statement,
        explanation: r.explanation,
        media: asArray(r.media),
        tags: asArray(r.tags),
        options: options
          .filter((o) => o.question_id === r.id)
          .map((o) => ({ letter: o.letter, body: o.body, isCorrect: Number(o.is_correct) === 1 })),
      } satisfies BankQuestion,
    ])
  );

  /* Deleted questions simply drop out — a session that outlived one of
     its questions is shorter, not broken. */
  return ids.map((id) => byId.get(id)).filter((q): q is BankQuestion => Boolean(q));
}

/** Random question ids across the chosen topics, for a new session. */
export async function sampleQuestionIds(
  topicIds: string[],
  count: number,
  ordering: "topic" | "random"
): Promise<string[]> {
  if (!(await bankReady())) return [];
  if (topicIds.length === 0) return [];

  const marks = topicIds.map(() => "?").join(",");
  /*
    ORDER BY RAND() is the wrong tool on a big table and the right one
    here: the bank is under a thousand rows per topic, and the
    alternative (fetch every id, shuffle in Node) moves more data for
    the same result.
  */
  const order = ordering === "random" ? "RAND()" : "q.topic_id, q.sort_order, q.id";

  const rows = await query<{ id: string }>(
    `SELECT q.id
       FROM qcm_questions q
      WHERE q.topic_id IN (${marks}) AND q.deleted_at IS NULL
      ORDER BY ${order}
      ${count > 0 ? "LIMIT ?" : ""}`,
    count > 0 ? [...topicIds, count] : topicIds
  );

  return rows.map((r) => r.id);
}
