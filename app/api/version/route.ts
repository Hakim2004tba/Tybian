import { NextResponse } from "next/server";
import { paymentMode, isPaymentConfigured } from "@/lib/payment";
import { tablesExist, QUIZ_TABLES, MEETING_TABLES } from "@/lib/db/tables";
import { dbStats } from "@/lib/db";
import { CHAT_TABLES } from "@/lib/data/meeting-chat";
import { PACK_TABLES } from "@/lib/data/packs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GET /api/version — which build is actually running.
 *
 * Added because a deployment cycle became guesswork: the uploaded files
 * and the running process can disagree (a process that did not restart,
 * a second app registered on the same domain, a half-replaced folder),
 * and from outside they look identical until something breaks.
 *
 * Returns no secrets — a build id, the Node version, and whether the
 * database and mail settings are present, never their values.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  /*
    Which feature migrations have actually been run.
    A feature whose SQL was never applied looks, from outside, exactly
    like a broken feature — this says which of the two it is without
    anyone having to open phpMyAdmin and guess.
  */
  const [quiz, meetings, chat, packs] = await Promise.all([
    tablesExist(QUIZ_TABLES).catch(() => false),
    tablesExist(MEETING_TABLES).catch(() => false),
    tablesExist(CHAT_TABLES).catch(() => false),
    tablesExist(PACK_TABLES).catch(() => false),
  ]);

  let buildId = "unknown";
  try {
    buildId = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    // standalone runs from .next/standalone, so try the sibling copy too
    try {
      buildId = readFileSync(join(process.cwd(), "..", ".next", "BUILD_ID"), "utf8").trim();
    } catch {}
  }

  return NextResponse.json({
    buildId,
    node: process.version,
    cwd: process.cwd(),
    startedAt: new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    env: {
      db: Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_PASSWORD),
      smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_PASSWORD),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      /*
        Which Chargily mode the RUNNING process is in — not which mode
        the file on disk says. Diagnosing a disabled pay button meant
        guessing at this from the outside; a mode is not a secret, and
        the key itself is never exposed.
      */
      payment: isPaymentConfigured ? paymentMode() : "not configured",
    },
    /*
      Cumulative since this process started — see dbStats in
      lib/db/index.ts. Load a page twice and read the difference to get
      its real query count.
    */
    db: {
      queries: dbStats.queries,
      totalMs: dbStats.totalMs,
      avgMs: dbStats.queries ? Math.round((dbStats.totalMs / dbStats.queries) * 10) / 10 : 0,
      slowestMs: dbStats.slowest,
      slowestSql: dbStats.slowestSql,
    },
    migrations: {
      "04-meetings.sql": meetings ? "applied" : "NOT APPLIED",
      "05-qcm.sql": quiz ? "applied" : "NOT APPLIED",
      "06-meeting-chat.sql": chat ? "applied" : "NOT APPLIED",
      "07-packs.sql": packs ? "applied" : "NOT APPLIED",
    },
  });
}
