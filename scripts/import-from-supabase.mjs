/**
 * TIBYAN — imports the Supabase export into MariaDB.
 *
 * Usage:
 *   node scripts/import-from-supabase.mjs "/path/to/Supabase Snippet ....csv"
 *   node scripts/import-from-supabase.mjs <file> --commit
 *
 * Without --commit it runs the whole thing inside a transaction and
 * ROLLS BACK, printing exactly what would be written. Do that first.
 *
 * Column mapping is derived from information_schema rather than
 * hardcoded: for each table it reads the real column list and types, and
 * copies only the keys that exist on both sides. A column Supabase has
 * and MariaDB does not is reported, never silently dropped — the whole
 * point of this script is that nothing disappears quietly.
 *
 * Values are converted per column type:
 *   DATETIME   ISO 8601 with a zone -> 'YYYY-MM-DD HH:MM:SS.mmm' in UTC
 *   TINYINT(1) true/false           -> 1/0
 *   JSON       object/array         -> serialised string
 *
 * The timestamp conversion is the one that would corrupt data silently
 * if skipped: Postgres exports '+00:00' offsets, MariaDB would store the
 * literal string as a local-time datetime, and every enrollment expiry
 * and payment time would shift by the server's offset.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const file = process.argv[2];
const COMMIT = process.argv.includes("--commit");

if (!file) {
  console.error('usage: node scripts/import-from-supabase.mjs "<export.csv|json>" [--commit]');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Read the export — accepts the CSV the SQL editor downloads, or JSON  */
/* ------------------------------------------------------------------ */
function loadExport(path) {
  const raw = readFileSync(path, "utf8");
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  // The CSV is one header line then one quoted cell holding the JSON,
  // with doubled quotes as CSV escaping.
  let body = raw.slice(raw.indexOf("\n") + 1).trim();
  if (body.startsWith('"')) body = body.slice(1, body.lastIndexOf('"')).replace(/""/g, '"');
  return JSON.parse(body);
}

const data = loadExport(file);

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

/*
  Dependency order. Parents before children, so every foreign key has
  something to point at as the load progresses.
*/
const ORDER = [
  "academic_years",
  "profiles",
  "teachers",
  "courses",
  "course_sections",
  "videos",
  "lessons",
  "lesson_resources",
  "course_prices",
  "coupons",
  "orders",
  "payments",
  "payment_events",
  "coupon_usage",
  "enrollments",
  "lesson_progress",
  "lesson_notes",
  "lesson_reviews",
  "study_sessions",
  "study_subjects",
  "study_items",
  "study_item_progress",
  "study_subject_exams",
  "reviews",
  "review_reactions",
  "comments",
  "comment_replies",
  "course_favorites",
  "content_reports",
  "sketches",
  "notifications",
  "student_activity",
  "ai_chat_usage",
  "analytics_snapshots",
  "platform_settings",
];

/** Reverse order, for clearing the target first. */
const CLEAR_ORDER = [...ORDER].reverse();

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  charset: "utf8mb4_unicode_ci",
  dateStrings: true,
  timezone: "Z",
  multipleStatements: false,
});

/** column name -> { type, nullable } for one table. */
async function columnsOf(table) {
  const [rows] = await conn.execute(
    `SELECT column_name, data_type, column_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?`,
    [env.DB_NAME, table]
  );
  const map = new Map();
  for (const r of rows) {
    const name = r.COLUMN_NAME ?? r.column_name;
    map.set(name, {
      type: (r.DATA_TYPE ?? r.data_type).toLowerCase(),
      columnType: (r.COLUMN_TYPE ?? r.column_type).toLowerCase(),
      nullable: (r.IS_NULLABLE ?? r.is_nullable) === "YES",
    });
  }
  return map;
}

/** ISO 8601 (with offset) -> MariaDB DATETIME(3) literal, in UTC. */
function toDatetime(value) {
  if (value === null || value === undefined) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 23).replace("T", " ");
}

function convert(value, col) {
  if (value === null || value === undefined) return null;

  if (col.type === "datetime" || col.type === "timestamp") return toDatetime(value);
  if (col.type === "date") return String(value).slice(0, 10);

  // TINYINT(1) is this schema's boolean.
  if (col.columnType.startsWith("tinyint(1)")) {
    return value === true || value === 1 || value === "true" ? 1 : 0;
  }

  if (col.type === "json") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

const report = [];
const warnings = [];

try {
  await conn.beginTransaction();
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  // Clear the target. The database holds only the seeded academic years
  // at this point, but clearing makes the script safe to re-run.
  for (const table of CLEAR_ORDER) {
    await conn.execute(`DELETE FROM \`${table}\``);
  }
  await conn.execute("DELETE FROM sessions");
  await conn.execute("DELETE FROM auth_tokens");
  await conn.execute("DELETE FROM users");

  /* ---------------------------------------------------------------- */
  /* users — rebuilt from auth.users                                    */
  /* ---------------------------------------------------------------- */
  /*
    Every account gets a password hash that cannot match anything.

    Supabase hashed passwords with bcrypt and does not export them, so
    there is nothing to carry over. This placeholder is deliberately
    malformed for verifyPassword(), which checks the salt and key
    lengths before comparing — so every sign-in attempt fails cleanly
    and the only way in is "forgot password". That is the honest state:
    the accounts exist, the people own them, the passwords do not.
  */
  const users = data.auth_users ?? [];
  for (const u of users) {
    await conn.execute(
      `INSERT INTO users (id, email, password_hash, email_verified_at, created_at)
       VALUES (?, ?, 'scrypt$00$00', ?, ?)`,
      [
        u.id,
        String(u.email).toLowerCase(),
        toDatetime(u.email_confirmed_at),
        toDatetime(u.created_at) ?? toDatetime(new Date().toISOString()),
      ]
    );
  }
  report.push({ table: "users", inserted: users.length, note: "passwords need reset" });

  /* ---------------------------------------------------------------- */
  /* everything else, generically                                       */
  /* ---------------------------------------------------------------- */
  for (const table of ORDER) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      report.push({ table, inserted: 0, note: "" });
      continue;
    }

    const cols = await columnsOf(table);
    if (cols.size === 0) {
      warnings.push(`table ${table} does not exist in MariaDB — SKIPPED (${rows.length} rows)`);
      continue;
    }

    // Report any Supabase column with no home here, once per table.
    const unknown = Object.keys(rows[0]).filter((k) => !cols.has(k));
    if (unknown.length) {
      warnings.push(`${table}: columns not in MariaDB, not imported -> ${unknown.join(", ")}`);
    }

    let inserted = 0;
    for (const row of rows) {
      const entries = Object.entries(row).filter(([k]) => cols.has(k));

      const payload = new Map(entries.map(([k, v]) => [k, convert(v, cols.get(k))]));

      /*
        analytics_snapshots.scope_id is NOT NULL here, with '-' standing
        for the platform-wide row — MariaDB treats NULLs in a unique key
        as distinct, so a NULL would let the cron pile up duplicates.
      */
      if (table === "analytics_snapshots" && (payload.get("scope_id") ?? null) === null) {
        payload.set("scope_id", "-");
      }

      // Tables that gained a surrogate id in this schema where Postgres
      // used a composite primary key.
      if (cols.has("id") && !payload.has("id")) payload.set("id", randomUUID());

      const keys = [...payload.keys()];
      await conn.execute(
        `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(",")})
         VALUES (${keys.map(() => "?").join(",")})`,
        keys.map((k) => payload.get(k))
      );
      inserted += 1;
    }

    report.push({ table, inserted, note: "" });
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  if (COMMIT) {
    await conn.commit();
    console.log("\nCOMMITTED — the data is in MariaDB.\n");
  } else {
    await conn.rollback();
    console.log("\nDRY RUN — rolled back, nothing was written.");
    console.log("Re-run with --commit to keep it.\n");
  }
} catch (error) {
  await conn.rollback().catch(() => {});
  console.error("\nFAILED — rolled back, nothing was written.");
  console.error(error.sqlMessage ?? error.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

console.table(report.filter((r) => r.inserted > 0));
console.log("total rows:", report.reduce((n, r) => n + r.inserted, 0));

if (warnings.length) {
  console.log("\nWARNINGS:");
  for (const w of warnings) console.log(" -", w);
}
