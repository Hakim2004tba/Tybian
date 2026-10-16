import "server-only";
import { query } from "@/lib/db";

/**
 * Whether a set of tables exists.
 *
 * Features that arrive with their own migration (live sessions, QCM)
 * are dead code until that SQL is run on the server. Without this the
 * first query simply throws ER_NO_SUCH_TABLE and the page renders as a
 * generic application error — which tells the person looking at it
 * nothing, and sends them to me instead of to phpMyAdmin.
 *
 * Cached for the life of the process. That is not a long life on this
 * host (Passenger restarts it constantly), but it is enough to keep one
 * page render from asking information_schema five times, and it means a
 * migration run while the app is up is picked up within seconds.
 */
const cache = new Map<string, boolean>();

export async function tablesExist(names: string[]): Promise<boolean> {
  const key = names.join(",");
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN (${names.map(() => "?").join(",")})`,
    names
  );

  const ok = rows.length === names.length;
  cache.set(key, ok);
  return ok;
}

/**
 * Whether one column exists on one table.
 *
 * Same reasoning as tablesExist, one level finer: a migration that only
 * ADDS A COLUMN leaves the table in place, so tablesExist still says
 * yes while every query naming the new column throws. Features that
 * arrive as a column (a lesson's linked course) ask this instead, and
 * simply stay hidden until the SQL is run.
 */
const columnCache = new Map<string, boolean>();

export async function columnExists(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const cached = columnCache.get(key);
  if (cached !== undefined) return cached;

  const rows = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );

  const ok = rows.length > 0;
  columnCache.set(key, ok);
  return ok;
}

export const QUIZ_TABLES = [
  "lesson_questions",
  "lesson_question_options",
  "lesson_quiz_attempts",
  "lesson_quiz_choices",
];

export const MEETING_TABLES = ["meetings", "meeting_attendance"];
