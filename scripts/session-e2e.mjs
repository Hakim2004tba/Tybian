/**
 * Proves the session cookie actually authenticates against the RUNNING
 * server — not just that the rows are right.
 *
 * Creates an account and a session row the way createSession() does,
 * then asks the real server for a protected page with that cookie. A
 * pass means the whole chain works: cookie -> sessions row -> profiles
 * join -> layout guard -> rendered page.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const BASE = process.argv[2] ?? "http://localhost:3220";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const c = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  charset: "utf8mb4_unicode_ci",
});

const results = [];
const check = (name, ok, detail = "") =>
  results.push({ check: name, result: ok ? "PASS" : "FAIL", detail });

const email = `e2e-${Date.now()}@example.test`;
const userId = randomUUID();
const sessionId = randomUUID();
const expiredId = randomUUID();

try {
  const [[year]] = await c.query("SELECT id FROM academic_years ORDER BY sort_order LIMIT 1");

  await c.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'scrypt$00$00')", [
    userId,
    email,
  ]);
  await c.execute(
    "INSERT INTO profiles (id, full_name, role, academic_year_id) VALUES (?, 'طالب اختبار', 'student', ?)",
    [userId, year.id]
  );
  await c.execute(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 DAY))",
    [sessionId, userId]
  );
  await c.execute(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY))",
    [expiredId, userId]
  );

  const get = (path, cookie) =>
    fetch(`${BASE}${path}`, {
      redirect: "manual",
      headers: cookie ? { cookie: `tibyan_session=${cookie}` } : {},
    });

  const anon = await get("/dashboard");
  check("no cookie -> redirected away from /dashboard", anon.status === 307 || anon.status === 302);

  const bogus = await get("/dashboard", randomUUID());
  check("made-up cookie -> still redirected", bogus.status === 307 || bogus.status === 302);

  const expired = await get("/dashboard", expiredId);
  check("expired session -> redirected", expired.status === 307 || expired.status === 302);

  const ok = await get("/dashboard", sessionId);
  const html = ok.status === 200 ? await ok.text() : "";
  check("valid session -> /dashboard renders", ok.status === 200, `HTTP ${ok.status}`);
  check("page shows the signed-in student's name", html.includes("طالب اختبار"));

  const admin = await get("/admin", sessionId);
  check("student cookie -> /admin refused", admin.status === 307 || admin.status === 302);

  // Promote and retry: proves the role is read from the database per
  // request, not baked into the cookie.
  await c.execute("UPDATE profiles SET role = 'admin' WHERE id = ?", [userId]);
  const asAdmin = await get("/admin", sessionId);
  check("after promotion, same cookie reaches /admin", asAdmin.status === 200, `HTTP ${asAdmin.status}`);

  await c.execute("UPDATE profiles SET role = 'student' WHERE id = ?", [userId]);
  const demoted = await get("/admin", sessionId);
  check("after demotion, same cookie refused again", demoted.status === 307 || demoted.status === 302);
} catch (error) {
  check("unexpected error", false, error.message);
} finally {
  await c.execute("DELETE FROM users WHERE email = ?", [email]).catch(() => {});
  await c.end();
}

console.table(results);
const failed = results.filter((r) => r.result === "FAIL").length;
console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
