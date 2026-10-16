/**
 * TIBYAN — runs a .sql file against the database in .env.local.
 *
 * There is no `mysql` command line client on a developer Mac by default
 * and no supabase CLI any more, so this is how schema and seed files get
 * applied without going through phpMyAdmin by hand.
 *
 * Usage:  node scripts/run-sql.mjs ../tibyan-db/mysql/02-seed.sql
 *
 * `multipleStatements` is on because these files are batches. That flag
 * is dangerous on a connection that ever carries user input — it turns a
 * single injection into an arbitrary sequence of statements — which is
 * why it lives here, in a script run by hand, and not in lib/db.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

function env() {
  return Object.fromEntries(
    readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

const e = env();
// Relative to where the command was run, not to this script — the .sql
// files live in a sibling package and every path to them reads from the
// shell's point of view.
const sql = readFileSync(resolve(process.cwd(), file), "utf8");

const conn = await mysql.createConnection({
  host: e.DB_HOST,
  port: Number(e.DB_PORT ?? 3306),
  user: e.DB_USER,
  password: e.DB_PASSWORD,
  database: e.DB_NAME,
  multipleStatements: true,
  charset: "utf8mb4_unicode_ci",
});

try {
  await conn.query(sql);
  console.log(`applied: ${file}`);
} catch (error) {
  console.error(`FAILED: ${file}`);
  console.error(error.sqlMessage ?? error.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
