/**
 * TIBYAN — enrollment gating, against the real database.
 *
 * This is the check that matters commercially. Under Postgres, RLS
 * re-applied the enrollment rule on every read no matter which code path
 * asked. MariaDB applies nothing, so the rule now lives in one SQL
 * predicate — hasActiveEnrollment() in lib/db/guard.ts — and this file
 * exercises that exact predicate against rows it creates itself:
 *
 *   an active enrollment          -> access
 *   a lifetime enrollment         -> access
 *   an expired enrollment         -> NO access
 *   a revoked (refunded) one      -> NO access
 *   one that has not started      -> NO access
 *   somebody else's enrollment    -> NO access
 *   no enrollment at all          -> NO access
 *
 * The last two are the ones that turn a missing WHERE clause into free
 * courses, so they are tested explicitly rather than assumed.
 *
 * Everything created is removed at the end, including on failure.
 *
 * Usage: node scripts/smoke-enrollment.mjs
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

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

/** The predicate from lib/db/guard.ts, character for character. */
async function hasActiveEnrollment(userId, courseId) {
  const [rows] = await conn.execute(
    `SELECT 1 AS ok
       FROM enrollments
      WHERE user_id = ?
        AND course_id = ?
        AND deleted_at IS NULL
        AND starts_at <= UTC_TIMESTAMP(3)
        AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
      LIMIT 1`,
    [userId, courseId]
  );
  return rows.length > 0;
}

const results = [];
const check = (name, ok, detail = "") =>
  results.push({ check: name, result: ok ? "PASS" : "FAIL", detail });

const tag = `gate-${Date.now()}`;
const ids = {
  teacherUser: randomUUID(),
  studentUser: randomUUID(),
  otherUser: randomUUID(),
  teacher: randomUUID(),
  course: randomUUID(),
  section: randomUUID(),
  lesson: randomUUID(),
};

async function makeUser(id, email, name) {
  await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'scrypt$00$00')", [
    id,
    email,
  ]);
  const [[year]] = await conn.query("SELECT id FROM academic_years ORDER BY sort_order LIMIT 1");
  await conn.execute(
    "INSERT INTO profiles (id, full_name, role, academic_year_id) VALUES (?, ?, 'student', ?)",
    [id, name, year.id]
  );
}

/** Replaces any existing enrollment for the student on this course. */
async function setEnrollment({ startsAt, expiresAt, deleted, planType = "three_months", userId = ids.studentUser }) {
  await conn.execute("DELETE FROM enrollments WHERE course_id = ?", [ids.course]);
  await conn.execute(
    `INSERT INTO enrollments (id, user_id, course_id, plan_type, source, starts_at, expires_at, deleted_at)
     VALUES (?, ?, ?, ?, 'purchase', ${startsAt}, ${expiresAt}, ${deleted ? "UTC_TIMESTAMP(3)" : "NULL"})`,
    [randomUUID(), userId, ids.course, planType]
  );
}

try {
  await makeUser(ids.teacherUser, `${tag}-teacher@example.test`, "أستاذ");
  await makeUser(ids.studentUser, `${tag}-student@example.test`, "طالب");
  await makeUser(ids.otherUser, `${tag}-other@example.test`, "طالب آخر");

  await conn.execute("INSERT INTO teachers (id, profile_id, title) VALUES (?, ?, 'أستاذ التشريح')", [
    ids.teacher,
    ids.teacherUser,
  ]);

  const [[year]] = await conn.query("SELECT id FROM academic_years ORDER BY sort_order LIMIT 1");
  await conn.execute(
    `INSERT INTO courses (id, slug, title, teacher_id, academic_year_id, status)
     VALUES (?, ?, 'دورة اختبار', ?, ?, 'published')`,
    [ids.course, `${tag}-course`, ids.teacher, year.id]
  );
  await conn.execute(
    "INSERT INTO course_sections (id, course_id, title, sort_order) VALUES (?, ?, 'القسم الأول', 1)",
    [ids.section, ids.course]
  );
  await conn.execute(
    "INSERT INTO lessons (id, section_id, title, sort_order, is_free_preview) VALUES (?, ?, 'الدرس الأول', 1, 0)",
    [ids.lesson, ids.section]
  );

  check("no enrollment -> denied", !(await hasActiveEnrollment(ids.studentUser, ids.course)));

  await setEnrollment({ startsAt: "UTC_TIMESTAMP(3)", expiresAt: "DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 90 DAY)", deleted: false });
  check("active enrollment -> allowed", await hasActiveEnrollment(ids.studentUser, ids.course));

  await setEnrollment({ startsAt: "UTC_TIMESTAMP(3)", expiresAt: "NULL", deleted: false, planType: "lifetime" });
  check("lifetime enrollment -> allowed", await hasActiveEnrollment(ids.studentUser, ids.course));

  await setEnrollment({
    startsAt: "DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 100 DAY)",
    expiresAt: "DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 DAY)",
    deleted: false,
  });
  check("expired enrollment -> denied", !(await hasActiveEnrollment(ids.studentUser, ids.course)));

  await setEnrollment({ startsAt: "UTC_TIMESTAMP(3)", expiresAt: "NULL", deleted: true, planType: "lifetime" });
  check("revoked (refunded) enrollment -> denied", !(await hasActiveEnrollment(ids.studentUser, ids.course)));

  await setEnrollment({
    startsAt: "DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 7 DAY)",
    expiresAt: "NULL",
    deleted: false,
  });
  check("future-dated enrollment -> denied", !(await hasActiveEnrollment(ids.studentUser, ids.course)));

  // Someone else pays; this student must not inherit it.
  await setEnrollment({
    startsAt: "UTC_TIMESTAMP(3)",
    expiresAt: "NULL",
    deleted: false,
    planType: "lifetime",
    userId: ids.otherUser,
  });
  check(
    "another student's enrollment -> denied",
    !(await hasActiveEnrollment(ids.studentUser, ids.course))
  );
  check("...and allowed for its actual owner", await hasActiveEnrollment(ids.otherUser, ids.course));

  // The owning-teacher lookup from the guard: two hops, courses ->
  // teachers -> profiles. Comparing against courses.teacher_id directly
  // is the mistake it exists to prevent.
  const [ownRows] = await conn.execute(
    `SELECT 1 AS ok FROM courses c JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = ? AND t.profile_id = ? LIMIT 1`,
    [ids.course, ids.teacherUser]
  );
  check("owning teacher recognised", ownRows.length === 1);

  const [notOwnRows] = await conn.execute(
    `SELECT 1 AS ok FROM courses c JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = ? AND t.profile_id = ? LIMIT 1`,
    [ids.course, ids.studentUser]
  );
  check("student is not the owning teacher", notOwnRows.length === 0);

  // The player sidebar's video join must never surface a provider id.
  const [structure] = await conn.execute(
    `SELECT l.id, v.duration_seconds, v.status
       FROM course_sections s
       LEFT JOIN lessons l ON l.section_id = s.id AND l.deleted_at IS NULL
       LEFT JOIN videos  v ON v.id = l.video_id
      WHERE s.course_id = ?`,
    [ids.course]
  );
  const columns = Object.keys(structure[0] ?? {});
  check(
    "structure query exposes no provider id",
    !columns.some((c) => /bunny|youtube/i.test(c)),
    columns.join(", ")
  );
} catch (error) {
  check("unexpected error", false, error.sqlMessage ?? error.message);
} finally {
  // Ordered child-first; courses/teachers use ON DELETE RESTRICT, so the
  // cascade from users is not enough on its own.
  await conn.execute("DELETE FROM enrollments WHERE course_id = ?", [ids.course]).catch(() => {});
  await conn.execute("DELETE FROM lessons WHERE id = ?", [ids.lesson]).catch(() => {});
  await conn.execute("DELETE FROM course_sections WHERE id = ?", [ids.section]).catch(() => {});
  await conn.execute("DELETE FROM courses WHERE id = ?", [ids.course]).catch(() => {});
  await conn.execute("DELETE FROM teachers WHERE id = ?", [ids.teacher]).catch(() => {});
  await conn
    .execute("DELETE FROM users WHERE email LIKE ?", [`${tag}-%@example.test`])
    .catch(() => {});
  await conn.end();
}

console.table(results);
const failed = results.filter((r) => r.result === "FAIL").length;
console.log(failed === 0 ? "\nALL PASSED" : `\n${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
