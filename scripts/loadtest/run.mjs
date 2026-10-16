#!/usr/bin/env node
/**
 * TIBYAN load test — realistic flows, no dependencies.
 *
 * WHY HAND-ROLLED: k6 and autocannon fire URLs. This has to fire
 * SESSIONS — a student logs in once, keeps a cookie, and then moves
 * through pages in an order that reuses the same warm data. Measuring
 * /dashboard with no cookie measures the redirect to /login, which is
 * fast and meaningless.
 *
 * SAFETY. It refuses to run against the production hostname unless
 * --i-know-this-is-production is passed, because a load test is
 * indistinguishable from an outage to the students using the site. It
 * only ever issues GETs and the specific POSTs a student would make
 * with their own account; it creates no data unless given a seeded
 * account, and never deletes any.
 *
 * USAGE
 *   node scripts/loadtest/run.mjs \
 *     --url https://staging.tybianacademy.com \
 *     --users 50 --duration 60 \
 *     --account student1@example.com:password \
 *     [--admin admin@example.com:password]   # enables pool stats
 *
 * The --admin account is optional and read-only: it is used solely to
 * read /api/admin/diagnostics before and after, which is how the
 * database query count and pool saturation get into the report.
 */
import { setTimeout as sleep } from "node:timers/promises";

/* ------------------------------------------------------------------ */
/* arguments                                                           */
/* ------------------------------------------------------------------ */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]);
    return acc;
  }, [])
);

const BASE = String(args.url ?? "http://localhost:3000").replace(/\/+$/, "");
const USERS = Number(args.users ?? 50);
const DURATION = Number(args.duration ?? 60);
const PRODUCTION = /tybianacademy\.com/i.test(BASE);

if (PRODUCTION && !args["i-know-this-is-production"]) {
  console.error(
    `\nREFUSING to load-test ${BASE}\n\n` +
      `That is the live site. Students would experience this as an outage.\n` +
      `Run it against a staging copy, or pass --i-know-this-is-production\n` +
      `if you have genuinely decided to accept that.\n`
  );
  process.exit(1);
}

if (!args.account) {
  console.error("--account email:password is required (a real seeded test student).");
  process.exit(1);
}
const [EMAIL, PASSWORD] = String(args.account).split(":");

/* ------------------------------------------------------------------ */
/* measurement                                                         */
/* ------------------------------------------------------------------ */
const samples = []; // { label, ms, status }
let errors = 0;

async function timed(label, fn) {
  const t0 = performance.now();
  try {
    const res = await fn();
    const ms = performance.now() - t0;
    samples.push({ label, ms, status: res?.status ?? 0 });
    if (!res || res.status >= 400) errors++;
    return res;
  } catch {
    samples.push({ label, ms: performance.now() - t0, status: 0 });
    errors++;
    return null;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

/* ------------------------------------------------------------------ */
/* one simulated student                                               */
/* ------------------------------------------------------------------ */

/**
 * Cookies are kept per virtual user, not globally: fifty students
 * sharing one session would all hit the same warm rows and make the
 * database look far faster than it is.
 */
function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    },
  };
}

async function get(jar, path, extra = {}) {
  const res = await fetch(BASE + path, {
    headers: { cookie: jar.header(), "accept-language": "ar", ...extra },
    redirect: "manual",
  });
  jar.absorb(res);
  await res.arrayBuffer(); // drain, so time-to-last-byte is measured
  return res;
}

/**
 * Sign-in goes through the server action, which is how the app itself
 * does it — there is no JSON login endpoint to shortcut to, and adding
 * one for the test would measure a path no student uses.
 */
async function login(jar) {
  const page = await get(jar, "/login");
  const html = await page.text?.().catch(() => "");
  const actionId = /"([0-9a-f]{40})"/.exec(html ?? "")?.[1];
  if (!actionId) return false;

  const body = new URLSearchParams({ email: EMAIL, password: PASSWORD });
  const res = await fetch(BASE + "/login", {
    method: "POST",
    headers: {
      cookie: jar.header(),
      "next-action": actionId,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "manual",
  });
  jar.absorb(res);
  await res.arrayBuffer();
  return res.status < 400;
}

/** The student flow from the brief, in the order a student does it. */
async function studentFlow(jar, courseSlug, lessonId) {
  await timed("dashboard", () => get(jar, "/dashboard"));
  await timed("explore", () => get(jar, "/dashboard/explore"));
  if (courseSlug) {
    await timed("course", () => get(jar, `/courses/${courseSlug}`));
    if (lessonId) {
      await timed("lesson", () => get(jar, `/courses/${courseSlug}/learn?lesson=${lessonId}`));
    }
  }
  await timed("dashboard-return", () => get(jar, "/dashboard"));
}

/** The library flow, including the byte ranges a PDF reader issues. */
async function libraryFlow(jar, documentId) {
  await timed("library-index", () => get(jar, "/dashboard/lessons"));
  if (!documentId) return;
  await timed("library-doc", () => get(jar, `/dashboard/lessons/${documentId}`));
  for (const range of ["bytes=0-65535", "bytes=65536-262143", "bytes=262144-524287"]) {
    await timed("pdf-range", () => get(jar, `/api/library/${documentId}/file`, { range }));
  }
}

/** The meeting flow: the version probe is what a poll actually costs. */
async function meetingFlow(jar, meetingId) {
  if (!meetingId) return;
  await timed("meeting", () => get(jar, `/dashboard/meetings/${meetingId}`));
}

/* ------------------------------------------------------------------ */
/* driver                                                              */
/* ------------------------------------------------------------------ */
async function diagnostics(jar) {
  try {
    const res = await get(jar, "/api/admin/diagnostics");
    return res.status === 200 ? JSON.parse(await res.text()) : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\nTIBYAN load test → ${BASE}`);
  console.log(`${USERS} concurrent students for ${DURATION}s\n`);

  /* Optional admin jar, purely to read counters before and after. */
  let adminJar = null;
  if (args.admin) {
    const [ae, ap] = String(args.admin).split(":");
    adminJar = makeJar();
    const saved = [EMAIL, PASSWORD];
    const ok = await (async () => {
      const j = adminJar;
      const page = await get(j, "/login");
      const html = await page.text?.().catch(() => "");
      const actionId = /"([0-9a-f]{40})"/.exec(html ?? "")?.[1];
      if (!actionId) return false;
      const res = await fetch(BASE + "/login", {
        method: "POST",
        headers: { cookie: j.header(), "next-action": actionId, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: ae, password: ap }),
        redirect: "manual",
      });
      j.absorb(res);
      await res.arrayBuffer();
      return res.status < 400;
    })();
    void saved;
    if (!ok) {
      console.log("admin login failed — continuing without pool stats\n");
      adminJar = null;
    }
  }

  const before = adminJar ? await diagnostics(adminJar) : null;

  const deadline = Date.now() + DURATION * 1000;
  const started = performance.now();

  const worker = async (n) => {
    const jar = makeJar();
    if (!(await login(jar))) {
      errors++;
      return;
    }
    while (Date.now() < deadline) {
      await studentFlow(jar, args.course, args.lesson);
      if (args.document) await libraryFlow(jar, args.document);
      if (args.meeting) await meetingFlow(jar, args.meeting);
      /* Students read. Firing with no pause measures a benchmark, not a
         classroom. */
      await sleep(400 + Math.random() * 800);
    }
  };

  await Promise.all(Array.from({ length: USERS }, (_, i) => worker(i)));

  const wall = (performance.now() - started) / 1000;
  const after = adminJar ? await diagnostics(adminJar) : null;

  /* ---- report ---- */
  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  const byLabel = new Map();
  for (const s of samples) {
    const list = byLabel.get(s.label) ?? [];
    list.push(s.ms);
    byLabel.set(s.label, list);
  }

  console.log("──────────────────────────────────────────────────────────");
  console.log(`requests        ${samples.length}`);
  console.log(`duration        ${wall.toFixed(1)}s`);
  console.log(`throughput      ${(samples.length / wall).toFixed(1)} req/s`);
  console.log(`errors          ${errors} (${((errors / Math.max(1, samples.length)) * 100).toFixed(2)}%)`);
  console.log(`avg             ${(all.reduce((a, b) => a + b, 0) / Math.max(1, all.length)).toFixed(0)} ms`);
  console.log(`p50             ${percentile(all, 50).toFixed(0)} ms`);
  console.log(`p95             ${percentile(all, 95).toFixed(0)} ms`);
  console.log(`p99             ${percentile(all, 99).toFixed(0)} ms`);
  console.log("──────────────────────────────────────────────────────────");
  console.log("slowest endpoints (p95):");
  [...byLabel.entries()]
    .map(([label, list]) => [label, percentile(list.sort((a, b) => a - b), 95), list.length])
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, p95, n]) => console.log(`  ${String(label).padEnd(20)} ${p95.toFixed(0).padStart(6)} ms   (${n})`));

  if (before?.pool && after?.pool) {
    console.log("──────────────────────────────────────────────────────────");
    const dq = after.pool.queries - before.pool.queries;
    console.log(`db queries       ${dq}`);
    console.log(`  per request    ${(dq / Math.max(1, samples.length)).toFixed(1)}`);
    console.log(`  avg latency    ${after.pool.avgMs} ms`);
    console.log(`  slowest        ${after.pool.slowestMs} ms  ${after.pool.slowestSql}`);
    console.log(`pool limit       ${after.pool.limit}`);
    console.log(`  max in flight  ${after.pool.maxInFlight}`);
    console.log(`  queued         ${after.pool.queued - before.pool.queued}   <- 0 means the pool is NOT the bottleneck`);
    if (after.database) {
      console.log(`db max_connections       ${after.database.max_connections}`);
      console.log(`db max_user_connections  ${after.database.max_user_connections}`);
      console.log(`db threads_connected     ${after.database.Threads_connected}`);
    }
  } else {
    console.log("\n(pass --admin email:password to include database and pool numbers)");
  }
  console.log();
}

main();
