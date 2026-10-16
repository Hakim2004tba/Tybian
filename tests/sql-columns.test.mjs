// Run with: node tests/sql-columns.test.mjs
//
// Checks every SQL statement in the app against the real schema:
// for each `alias.column`, does that alias's TABLE actually have that
// column?
//
// WHY THIS EXISTS: TypeScript cannot see inside a SQL template literal,
// and `npm run build` compiles a wrong column name happily. Two such
// typos — `lp.completed` for `lp.is_completed`, and `s.position` for
// `s.sort_order` — reached production and took down a page each. Both
// would have failed here in under a second.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath, not URL.pathname: this project lives in a directory
   whose name contains a space, and .pathname hands back "%20". */
const HERE = dirname(fileURLToPath(import.meta.url));

/*
  EVERY migration, not just the base schema.

  This started as 01-schema.sql alone, which quietly meant that every
  table added by a later migration — meetings, QCM, packs, the library —
  was invisible to the audit: a query naming a column those tables do
  not have passed the check that exists to catch exactly that. The base
  schema is read first so a later ALTER can add to what it declared.
*/
const SCHEMA_DIR = "../../tibyan-db/mysql";
const ROOTS = ["lib", "app"];

const TYPES =
  "CHAR|VARCHAR|TEXT|LONGTEXT|MEDIUMTEXT|TINYTEXT|INT|SMALLINT|TINYINT|BIGINT|DECIMAL|FLOAT|DOUBLE|DATETIME|DATE|TIME|YEAR|ENUM|JSON|BLOB|BOOLEAN";

/** table -> { cols: Set, required: Set }  (required = NOT NULL, no default) */
function loadSchema() {
  const dir = resolve(HERE, SCHEMA_DIR);
  /*
    Read per FILE, not as one concatenated string.

    The directory also holds a Postgres-era export whose CREATE TABLE
    statements do not end in `) ENGINE`. Joined together, the lazy match
    for such a statement ran past the end of that file and swallowed the
    next file's tables with it — nine of them vanished from the audit
    without a word. A per-file scan cannot leak across the boundary.
  */
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort() // 01, 02, ... so a CREATE is always read before its ALTER
    .map((f) => readFileSync(resolve(dir, f), "utf8"));
  const sql = sources.join("\n");

  const tables = new Map();
  // `IF NOT EXISTS` is optional: the base schema omits it, every later
  // migration uses it so it can be re-run safely. Without this alternative
  // the capture group took the literal word "IF" and the table was skipped
  // silently — which is how the whole library feature stayed unaudited.
  const re = /CREATE TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\n\)\s*ENGINE/gi;
  let m;
  for (const source of sources) {
  re.lastIndex = 0;
  while ((m = re.exec(source))) {
    const cols = new Set();
    const required = new Set();
    for (const line of m[2].split("\n")) {
      const c = line.match(new RegExp(`^\\s*\`?(\\w+)\`?\\s+(?:${TYPES})\\b`, "i"));
      if (!c) continue;
      cols.add(c[1]);
      /*
        A column the database will refuse to default: NOT NULL, no
        DEFAULT, and not AUTO_INCREMENT. Omitting one from an INSERT is
        a runtime failure the build cannot see — `enrollments.plan_type`
        went missing from a pack purchase exactly this way.
      */
      const notNull = /\bNOT\s+NULL\b/i.test(line);
      const hasDefault = /\bDEFAULT\b/i.test(line) || /AUTO_INCREMENT/i.test(line);
      if (notNull && !hasDefault) required.add(c[1]);
    }
    tables.set(m[1], { cols, required });
  }
  }

  /*
    Columns added by a later migration.

    Several features extend an existing table instead of creating one —
    orders.pack_id arrived that way. Without this the audit would report
    a real column as unknown and start crying wolf, which is how a
    useful check gets ignored.
  */
  const alter = /ALTER TABLE\s+`?(\w+)`?([\s\S]*?);/g;
  let a;
  while ((a = alter.exec(sql))) {
    const table = tables.get(a[1]);
    if (!table) continue;
    const add = new RegExp(
      `ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?\`?(\\w+)\`?\\s+(?:${TYPES})\\b`,
      "gi"
    );
    let c;
    while ((c = add.exec(a[2]))) table.cols.add(c[1]);
  }

  return tables;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next") continue;
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(full)) yield full;
  }
}

const tables = loadSchema();
const problems = [];

for (const file of ROOTS.flatMap((r) => [...walk(resolve(HERE, "..", r))])) {
  const src = readFileSync(file, "utf8");
  const statements = src.match(/`[^`]*?(?:SELECT|INSERT INTO|UPDATE)[^`]*?`/gs) ?? [];

  for (const sql of statements) {
    // Aliases this statement declares: FROM t a / JOIN t AS a / FROM t
    const alias = new Map();
    const reserved = new Set(["ON", "WHERE", "SET", "VALUES", "GROUP", "ORDER", "LIMIT", "LEFT", "INNER", "JOIN"]);
    for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+`?(\w+)`?\s+(?:AS\s+)?(\w+)\b/gi)) {
      if (tables.has(m[1]) && !reserved.has(m[2].toUpperCase())) alias.set(m[2], m[1]);
    }
    for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+`?(\w+)`?/gi)) {
      if (tables.has(m[1]) && !alias.has(m[1])) alias.set(m[1], m[1]);
    }

    const computed = new Set([...sql.matchAll(/\bAS\s+(\w+)/gi)].map((m) => m[1]));

    for (const m of sql.matchAll(/\b(\w+)\.(\w+)\b/g)) {
      const [, a, col] = m;
      if (!alias.has(a)) continue;
      const table = alias.get(a);
      if (tables.get(table).cols.has(col) || computed.has(col)) continue;
      problems.push(`${file.split("/").slice(-2).join("/")}: ${a}.${col} — table \`${table}\` has no column \`${col}\``);
    }
  }
}

/* ---- INSERTs must name every column the schema will not default ---- */
for (const file of ROOTS.flatMap((r) => [...walk(resolve(HERE, "..", r))])) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/INSERT\s+INTO\s+`?(\w+)`?\s*\(([^)]*)\)/gis)) {
    const table = m[1];
    if (!tables.has(table)) continue;
    const named = new Set(m[2].split(",").map((c) => c.trim().replace(/`/g, "")));
    for (const col of tables.get(table).required) {
      if (!named.has(col)) {
        problems.push(
          `${file.split("/").slice(-2).join("/")}: INSERT INTO ${table} omits required column \`${col}\``
        );
      }
    }
  }
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.error("SQL problems:\n");
  for (const p of unique) console.error("  " + p);
  console.error(`\n${unique.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`checked ${tables.size} tables — columns and required-column INSERTs all valid`);
}
