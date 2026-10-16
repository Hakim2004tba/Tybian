import "server-only";
import mysql, { type Pool, type PoolOptions, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

/**
 * TIBYAN — MariaDB connection.
 *
 * Replaces lib/supabase/{client,server,admin}.ts. There is no anon key
 * and no service_role key any more, and — this is the part that matters —
 * no Row Level Security. Postgres used to re-check every policy on every
 * read no matter which code path asked; MariaDB checks nothing. The rules
 * that were in 0009_rls_policies.sql now live in lib/db/guard.ts, and a
 * query that skips the guard is a query with no authorization at all.
 *
 * So: `server-only`. If this module is ever reachable from a Client
 * Component the build fails, which is the same protection the old admin
 * client had, for the same reason — except now it applies to ALL database
 * access, because all database access is privileged.
 */

declare global {
  // eslint-disable-next-line no-var
  var __tibyanPool: Pool | undefined;
}

function config(): PoolOptions {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error(
      "Database is not configured. Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in .env.local " +
        "(see .env.local.example). On cPanel the user and database names carry the account prefix, " +
        "e.g. gxxzkaef_tybian."
    );
  }

  return {
    host: DB_HOST,
    port: Number(DB_PORT ?? 3306),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,

    /*
      Five, not the library's default of ten.

      Shared hosting caps concurrent connections per account — often at
      around 20 across everything, mail and cron included. Next.js opens a
      pool per server process, so a generous limit here is how a small site
      starts returning "max_user_connections" under a burst that the
      database itself could have handled comfortably.
    */
    connectionLimit: POOL_LIMIT,
    queueLimit: 0,
    waitForConnections: true,
    enableKeepAlive: true,

    charset: "utf8mb4_unicode_ci",

    /*
      DATETIME columns come back as strings, not JS Dates.

      mysql2 would otherwise construct a Date using the *server process's*
      local timezone, which on shared hosting is whatever the host chose
      and is not knowable from here. Every timestamp in this schema is
      UTC; parsing it as local time would shift enrollment expiry and
      payment times by hours, silently. The data layer converts explicitly
      instead — see `toDate()` below.
    */
    dateStrings: true,

    /*
      Send session times as UTC too, so NOW() and CURRENT_TIMESTAMP in the
      schema's own DEFAULTs agree with what the application writes.
    */
    timezone: "Z",

    // Large ids and money read back as strings rather than losing
    // precision in a float. DECIMAL(10,2) especially: amounts are money.
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

/**
 * One pool per process, cached on `globalThis`.
 *
 * Next.js in development re-evaluates modules on every hot reload; a
 * module-level `const pool` would leak a new pool of connections each
 * time until the database refuses more. This is the standard workaround
 * and is a no-op in production.
 */
export function pool(): Pool {
  if (!globalThis.__tibyanPool) {
    const created = mysql.createPool(config());

    /*
      Put every connection's session clock on UTC.

      `timezone: "Z"` above only tells mysql2 how to read datetimes back;
      it does not touch the server's own clock. The MariaDB host runs at
      UTC+1, so a column filled by `DEFAULT CURRENT_TIMESTAMP` landed an
      hour ahead of the same row's `UTC_TIMESTAMP(3)` values written by
      the application — two different "now" in one table. Enrollment
      expiry compares UTC to UTC and was never wrong, but `created_at`
      was, and any future comparison across the two would be.

      Setting it per connection rather than asking the host to change its
      timezone keeps this true on any server the app is moved to.
    */
    created.on("connection", (conn) => {
      conn.query("SET time_zone = '+00:00'");
    });

    globalThis.__tibyanPool = created;
  }
  return globalThis.__tibyanPool;
}

/**
 * A value that may be bound to a `?` placeholder.
 *
 * Deliberately not `unknown[]`: the point of a parameter list is that
 * every element is something the driver knows how to escape. Widening it
 * would let an object or a function reach `execute()` and be stringified
 * into the statement, which is how a parameterised query stops being one.
 */
export type SqlValue = string | number | boolean | null | Date | Buffer;


/**
 * How many statements this process has run, and how long they took.
 *
 * Twelve bytes of bookkeeping, exposed on /api/version, so a change
 * like "the dashboard no longer looks the session up eleven times" can
 * be MEASURED on the real server instead of asserted: load a page
 * twice, read the delta, compare. Without it every performance claim
 * about this app is a story about the code rather than a fact about
 * the database.
 *
 * Deliberately a plain counter and not a per-request tracer: an
 * AsyncLocalStorage context around every query would cost more than
 * the thing it measures.
 */
/*
  Raised from five, on measured evidence rather than optimism.

  /api/admin/diagnostics now reports what the server itself says:

    max_connections       8000
    max_user_connections  0      (no per-account cap)
    Max_used_connections  204    (the busiest this box has ever been)
    queued                0      (nothing waited on the pool)

  So five was not a limit the host imposed — it was a guess made when
  the cap was unknown, and the cap turns out to be nowhere near. Ten
  costs nothing while idle and gives the login and render bursts room
  that five did not, without approaching anything the server minds.

  It is NOT raised further: `queued: 0` says the pool is not currently
  the bottleneck, and a pool bigger than the work is just idle sockets.
  Watch `queued` after a busy hour; if it climbs, this is the number to
  move.
*/
export const POOL_LIMIT = 10;

export const dbStats = {
  queries: 0,
  totalMs: 0,
  slowest: 0,
  slowestSql: "",
  /*
    POOL SATURATION, which is the number this audit actually needs.

    mysql2 does not report how long a query waited for a free
    connection, so this measures the thing that causes the wait:
    how many statements are in flight at once. Every statement that
    starts while POOL_LIMIT are already running is one that had to
    queue — `queued` counts those, and `maxInFlight` shows how deep it
    got.

    queued = 0 after a busy period means the pool is NOT the
    bottleneck and raising it would buy nothing. That is a fact worth
    having before touching a setting that can take the site down by
    exceeding the host's connection cap.
  */
  inFlight: 0,
  maxInFlight: 0,
  queued: 0,
};

function record(sql: string, startedAt: number): void {
  const ms = Date.now() - startedAt;
  dbStats.queries++;
  dbStats.totalMs += ms;
  if (ms > dbStats.slowest) {
    dbStats.slowest = ms;
    // First line only, and never the parameters — those are user data.
    dbStats.slowestSql = sql.trim().split("\n")[0].slice(0, 120);
  }
}

/** Marks a statement as started; returns its start time. */
function begin(): number {
  dbStats.inFlight++;
  if (dbStats.inFlight > dbStats.maxInFlight) dbStats.maxInFlight = dbStats.inFlight;
  if (dbStats.inFlight > POOL_LIMIT) dbStats.queued++;
  return Date.now();
}

function end(sql: string, startedAt: number): void {
  dbStats.inFlight--;
  record(sql, startedAt);
}

/** Rows from a SELECT. Always parameterised — never interpolate values. */
export async function query<T = RowDataPacket>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  const startedAt = begin();
  try {
    const [rows] = await pool().execute(sql, params);
    return rows as T[];
  } finally {
    // finally, so a failed query cannot leave inFlight counting up
    // forever and report permanent saturation.
    end(sql, startedAt);
  }
}

/** The first row, or null. */
export async function queryOne<T = RowDataPacket>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE. Returns affectedRows and insertId. */
export async function execute(sql: string, params: SqlValue[] = []): Promise<ResultSetHeader> {
  const startedAt = begin();
  try {
    const [result] = await pool().execute(sql, params);
    return result as ResultSetHeader;
  } finally {
    end(sql, startedAt);
  }
}

/**
 * Runs `fn` inside a transaction on a single connection, rolling back if
 * it throws.
 *
 * Checkout needs this and cannot be written without it: creating an
 * order, recording the payment and granting the enrollment must either
 * all happen or none of them. Postgres RPCs used to give that atomicity
 * for free (create_order, etc. were single function calls); those move
 * into TypeScript now, and this is what keeps them honest.
 *
 * Note the callback receives the connection — every statement inside must
 * use it, not the pool, or it will run outside the transaction.
 */
export async function transaction<T>(
  fn: (tx: import("mysql2/promise").PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/* ------------------------------------------------------------------ */
/* Value helpers — the small type mismatches between MariaDB and the app */
/* ------------------------------------------------------------------ */

/** `crypto.randomUUID()`. Ids came from gen_random_uuid() in Postgres. */
export function newId(): string {
  return crypto.randomUUID();
}

/** A UTC 'YYYY-MM-DD HH:MM:SS.mmm' literal for a DATETIME(3) column. */
export function toSql(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

/** Parses a DATETIME(3) string back into a Date, reading it as UTC. */
export function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value.replace(" ", "T") + "Z");
}

/** MariaDB has no booleans; TINYINT(1) comes back as 0 or 1. */
export function toBool(value: number | boolean | null): boolean {
  return value === 1 || value === true;
}

/**
 * Reads a JSON column that replaced a Postgres array.
 *
 * MariaDB stores JSON as LONGTEXT, so a driver may hand back either a
 * parsed value or the raw string depending on version — and the schema
 * allows NULL where Postgres had `not null default '{}'`, because MySQL
 * 5.7 and MariaDB forbid a DEFAULT on a JSON column. All three cases mean
 * "empty" to the caller.
 */
export function toArray<T = string>(value: unknown): T[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
