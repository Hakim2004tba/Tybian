/**
 * TIBYAN — end-to-end check of the account path against the real
 * database.
 *
 * Runs the same sequence signUpAction and signInAction perform: the
 * signup transaction, a session row, the login lookup, and a password
 * verification that must succeed for the right password and fail for the
 * wrong one. Then deletes everything it made.
 *
 * The password hashing here is a copy of lib/auth/password.ts rather than
 * an import: that module is marked `server-only`, which throws outside a
 * Next request. Keeping the parameters identical is the point — if this
 * passes, the hash format in the database is the one the app writes.
 *
 * Usage: node scripts/smoke-auth.mjs
 */
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCb);
const KEYLEN = 64;
const SALT_BYTES = 16;

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;
  const actual = await scrypt(password, salt, KEYLEN);
  return timingSafeEqual(actual, expected);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  charset: "utf8mb4_unicode_ci",
  dateStrings: true,
  timezone: "Z",
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ check: name, result: ok ? "PASS" : "FAIL", detail });
  return ok;
};

const email = `smoke-${Date.now()}@example.test`;
const password = "correct horse battery";
const userId = randomUUID();
const sessionId = randomUUID();
// Arabic on purpose: this is the utf8mb4 round trip that "utf8" breaks.
const fullName = "أحمد بن علي";

try {
  const [[year]] = await conn.query("SELECT id FROM academic_years ORDER BY sort_order LIMIT 1");
  check("academic years seeded", !!year);

  const passwordHash = await hashPassword(password);

  // --- signup, as one transaction, exactly as signUpAction does --------
  await conn.beginTransaction();
  await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
    userId,
    email,
    passwordHash,
  ]);
  await conn.execute(
    "INSERT INTO profiles (id, full_name, role, academic_year_id) VALUES (?, ?, 'student', ?)",
    [userId, fullName, year.id]
  );
  await conn.execute(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, 'email_verify', ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 DAY))`,
    [randomUUID(), userId, randomBytes(32).toString("hex")]
  );
  await conn.commit();
  check("signup transaction committed", true);

  // --- the login lookup ------------------------------------------------
  const [[account]] = await conn.execute(
    `SELECT u.id, u.email, u.password_hash, p.full_name, p.role, p.deleted_at
       FROM users u JOIN profiles p ON p.id = u.id
      WHERE u.email = ?`,
    [email]
  );
  check("account found by email", !!account);
  check("profile created with account", account?.full_name === fullName, account?.full_name);
  check("role defaults to student", account?.role === "student", account?.role);
  check("Arabic name survives round trip", account?.full_name === fullName);

  check("correct password verifies", await verifyPassword(password, account.password_hash));
  check("wrong password rejected", !(await verifyPassword("wrong password", account.password_hash)));

  // --- session ---------------------------------------------------------
  await conn.execute(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 DAY))`,
    [sessionId, userId]
  );
  const [[live]] = await conn.execute(
    `SELECT s.user_id FROM sessions s WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3)`,
    [sessionId]
  );
  check("session resolves", live?.user_id === userId);

  const [[expired]] = await conn.execute(
    `SELECT 1 AS ok FROM sessions
      WHERE id = ? AND expires_at > DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 60 DAY)`,
    [sessionId]
  );
  check("expiry comparison works", !expired);

  // --- constraints the app now relies on -------------------------------
  let duplicateRejected = false;
  try {
    await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      randomUUID(),
      email,
      passwordHash,
    ]);
  } catch (e) {
    duplicateRejected = e.code === "ER_DUP_ENTRY";
  }
  check("duplicate email rejected", duplicateRejected);

  let badVideoRejected = false;
  try {
    await conn.execute(
      `INSERT INTO videos (id, source, bunny_video_id, youtube_video_id, title)
       VALUES (?, 'bunny', ?, ?, 'both ids set')`,
      [randomUUID(), "b-" + randomUUID(), "y-" + randomUUID()]
    );
  } catch {
    badVideoRejected = true;
  }
  check("CHECK constraint enforced (MariaDB)", badVideoRejected);

  // --- cascade ----------------------------------------------------------
  await conn.execute("DELETE FROM users WHERE id = ?", [userId]);
  const [[goneProfile]] = await conn.execute("SELECT 1 AS ok FROM profiles WHERE id = ?", [userId]);
  const [[goneSession]] = await conn.execute("SELECT 1 AS ok FROM sessions WHERE id = ?", [sessionId]);
  check("deleting account cascades to profile", !goneProfile);
  check("deleting account cascades to sessions", !goneSession);
} catch (error) {
  try {
    await conn.rollback();
  } catch {}
  check("unexpected error", false, error.sqlMessage ?? error.message);
} finally {
  await conn.execute("DELETE FROM users WHERE email = ?", [email]).catch(() => {});
  await conn.execute("DELETE FROM videos WHERE title = 'both ids set'").catch(() => {});
  await conn.end();
}

console.table(results);
const failed = results.filter((r) => r.result === "FAIL").length;
console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
