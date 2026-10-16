import "server-only";
import { query, queryOne } from "@/lib/db";
import { tablesExist } from "@/lib/db/tables";

export async function sessionsReady(): Promise<boolean> {
  return tablesExist(["qcm_sessions", "qcm_answers", "qcm_questions"]);
}

/** Safe JSON — a malformed column must not take the page down. */
function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export type SessionRow = {
  id: string;
  title: string;
  mode: "instant" | "exam";
  total: number;
  /** How many of the set carry a recorded answer. */
  answered: number;
  right: number;
  /** Right out of ANSWERED — "how accurate was I", distinct from progress. */
  accuracy: number;
  /** Answered out of TOTAL. */
  percent: number;
  seconds: number;
  finished: boolean;
  createdAt: string;
  topics: string[];
};

/**
 * A student's sessions, newest first.
 *
 * The counts come from qcm_answers joined on session_id rather than
 * from columns on the session: an answer can be revised, and a stored
 * counter would have to be kept in step with every write. Counting is
 * cheap here — a session is tens of rows, not millions.
 */
export async function listSessions(userId: string, limit = 50): Promise<SessionRow[]> {
  if (!(await sessionsReady())) return [];

  const rows = await query<{
    id: string; title: string; mode: string; total: number;
    finished_at: Date | null; created_at: Date; topic_ids: unknown;
    answered: number; right_count: number; seconds: number;
  }>(
    `SELECT s.id, s.title, s.mode, s.total, s.finished_at, s.created_at, s.topic_ids,
            (SELECT COUNT(*) FROM qcm_answers a
              WHERE a.session_id = s.id) AS answered,
            (SELECT COUNT(*) FROM qcm_answers a
              WHERE a.session_id = s.id AND a.is_correct = 1) AS right_count,
            (SELECT COALESCE(SUM(a.seconds), 0) FROM qcm_answers a
              WHERE a.session_id = s.id) AS seconds
       FROM qcm_sessions s
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?`,
    [userId, limit]
  );

  const topicNames = await topicNameMap(rows.flatMap((r) => parseIds(r.topic_ids)));

  return rows.map((r) => {
    const answered = Number(r.answered);
    const right = Number(r.right_count);
    const total = Number(r.total);
    return {
      id: r.id,
      title: r.title,
      mode: r.mode === "exam" ? "exam" : "instant",
      total,
      answered,
      right,
      accuracy: answered > 0 ? Math.round((right / answered) * 100) : 0,
      percent: total > 0 ? Math.round((answered / total) * 100) : 0,
      seconds: Number(r.seconds),
      finished: r.finished_at !== null,
      createdAt: new Date(r.created_at).toISOString(),
      topics: parseIds(r.topic_ids).map((id) => topicNames.get(id) ?? "").filter(Boolean),
    };
  });
}

async function topicNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await query<{ id: string; title: string }>(
    `SELECT id, title FROM qcm_topics WHERE id IN (${unique.map(() => "?").join(",")})`,
    unique
  );
  return new Map(rows.map((r) => [r.id, r.title]));
}

export type BankStats = {
  sessions: number;
  open: number;
  answered: number;
  right: number;
  accuracy: number;
  seconds: number;
  /** Distinct questions ever answered correctly — real coverage. */
  mastered: number;
  bankSize: number;
};

/**
 * Everything the student has ever done, across sessions.
 *
 * `mastered` counts DISTINCT questions answered correctly, not correct
 * answers: a question re-answered right in four sessions is one
 * question learned, and counting it four times would let the coverage
 * number pass the size of the bank.
 */
export async function bankStats(userId: string): Promise<BankStats> {
  if (!(await sessionsReady())) {
    return { sessions: 0, open: 0, answered: 0, right: 0, accuracy: 0, seconds: 0, mastered: 0, bankSize: 0 };
  }

  const r = await queryOne<{
    sessions: number; open_count: number; answered: number;
    right_count: number; seconds: number; mastered: number; bank: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM qcm_sessions WHERE user_id = ?) AS sessions,
       (SELECT COUNT(*) FROM qcm_sessions WHERE user_id = ? AND finished_at IS NULL) AS open_count,
       (SELECT COUNT(*) FROM qcm_answers WHERE user_id = ?) AS answered,
       (SELECT COUNT(*) FROM qcm_answers WHERE user_id = ? AND is_correct = 1) AS right_count,
       (SELECT COALESCE(SUM(seconds), 0) FROM qcm_answers WHERE user_id = ?) AS seconds,
       (SELECT COUNT(DISTINCT question_id) FROM qcm_answers
         WHERE user_id = ? AND is_correct = 1) AS mastered,
       (SELECT COUNT(*) FROM qcm_questions WHERE deleted_at IS NULL) AS bank`,
    [userId, userId, userId, userId, userId, userId]
  );

  const answered = Number(r?.answered ?? 0);
  const right = Number(r?.right_count ?? 0);
  return {
    sessions: Number(r?.sessions ?? 0),
    open: Number(r?.open_count ?? 0),
    answered,
    right,
    accuracy: answered > 0 ? Math.round((right / answered) * 100) : 0,
    seconds: Number(r?.seconds ?? 0),
    mastered: Number(r?.mastered ?? 0),
    bankSize: Number(r?.bank ?? 0),
  };
}

export type SessionDetail = {
  id: string;
  title: string;
  mode: "instant" | "exam";
  ordering: string;
  questionIds: string[];
  cursorAt: number;
  finished: boolean;
  /** questionId → what was committed, for resuming mid-session. */
  answers: Record<string, { chosen: string[]; seconds: number }>;
};

export async function sessionDetail(userId: string, id: string): Promise<SessionDetail | null> {
  if (!(await sessionsReady())) return null;

  const s = await queryOne<{
    id: string; title: string; mode: string; ordering: string;
    question_ids: unknown; cursor_at: number; finished_at: Date | null;
  }>(
    `SELECT id, title, mode, ordering, question_ids, cursor_at, finished_at
       FROM qcm_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (!s) return null;

  const rows = await query<{ question_id: string; chosen: unknown; seconds: number }>(
    `SELECT question_id, chosen, seconds FROM qcm_answers WHERE session_id = ?`,
    [id]
  );

  const answers: SessionDetail["answers"] = {};
  for (const row of rows) {
    answers[row.question_id] = { chosen: parseIds(row.chosen), seconds: Number(row.seconds) };
  }

  return {
    id: s.id,
    title: s.title,
    mode: s.mode === "exam" ? "exam" : "instant",
    ordering: s.ordering,
    questionIds: parseIds(s.question_ids),
    cursorAt: Number(s.cursor_at),
    finished: s.finished_at !== null,
    answers,
  };
}

export type PickerTopic = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  questionCount: number;
};

/** Every openable topic with its question count, for the picker. */
export async function pickerTopics(): Promise<PickerTopic[]> {
  if (!(await tablesExist(["qcm_topics", "qcm_subjects", "qcm_questions"]))) return [];

  const rows = await query<{
    id: string; title: string; subject_id: string; subject_name: string; n: number;
  }>(
    `SELECT t.id, t.title, t.subject_id, s.name AS subject_name,
            (SELECT COUNT(*) FROM qcm_questions q
              WHERE q.topic_id = t.id AND q.deleted_at IS NULL) AS n
       FROM qcm_topics t
       JOIN qcm_subjects s ON s.id = t.subject_id
      WHERE s.is_active = 1
      ORDER BY s.sort_order, s.name, t.sort_order, t.title`
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    questionCount: Number(r.n),
  }));
}

/** The questions of a session, in the session's own frozen order. */
export async function sessionQuestions(questionIds: string[]) {
  if (questionIds.length === 0) return [];
  const { topicQuestionsByIds } = await import("@/lib/data/qcm-bank");
  return topicQuestionsByIds(questionIds);
}
