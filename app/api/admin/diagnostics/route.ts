import { NextResponse } from "next/server";
import { access, constants, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "@/lib/auth/session";
import { verifySmtp, sendTestEmail, platformEmail } from "@/lib/mail";
import { redirectUri } from "@/lib/auth/google";
import { probeAi } from "@/lib/ai/provider";
import { query, dbStats, POOL_LIMIT } from "@/lib/db";

/**
 * GET /api/admin/diagnostics — what is actually broken, for an admin.
 *
 * /api/version reports whether environment variables EXIST. That was
 * enough to find a missing DB_HOST, and useless for the failures that
 * followed: mail whose password is wrong, and a Google client whose
 * secret was rotated in the console but not here. Both present exactly
 * the same from outside as "nothing happens".
 *
 * Everything here is a live check against the real service, and none of
 * it returns a secret — SMTP's own error text, Google's own short error
 * code, the redirect URI that must be registered in the console.
 *
 * Admin-only, because the SMTP error text names the host and user.
 *
 * Add ?sendTo=<address> to have it actually deliver a message, which is
 * the only way to tell authentication from delivery.
 */
export const dynamic = "force-dynamic";

const LIBRARY_DIR = process.env.LIBRARY_DIR ?? join(process.cwd(), "..", "tibyan-library");

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sendTo = new URL(request.url).searchParams.get("sendTo");

  const [smtp, ai] = await Promise.all([verifySmtp(), probeAi()]);
  const delivery = sendTo && smtp.ok ? await sendTestEmail(sendTo) : null;

  /* Can the library actually be written to? A read-only or missing
     directory turns every upload into a 500 with nothing to see. */
  let libraryWritable: boolean;
  try {
    await mkdir(LIBRARY_DIR, { recursive: true });
    await access(LIBRARY_DIR, constants.W_OK);
    libraryWritable = true;
  } catch {
    libraryWritable = false;
  }

  /*
    THE DATABASE'S OWN LIMITS, asked of the database.

    Whether the pool of five can safely be raised depends on a number
    only the server knows: how many connections this account may hold.
    SHOW VARIABLES is readable by an ordinary user, so the answer is
    obtainable here rather than through a support ticket.

    max_user_connections = 0 means "no per-user cap", in which case
    max_connections (server-wide, shared with every other account on
    this box) is the real ceiling. Threads_connected shows how much of
    it is in use right now, by everyone.
  */
  let database: Record<string, unknown>;
  try {
    const [vars, status] = await Promise.all([
      query<{ Variable_name: string; Value: string }>(
        `SHOW VARIABLES WHERE Variable_name IN
           ('max_connections','max_user_connections','wait_timeout','version')`
      ),
      query<{ Variable_name: string; Value: string }>(
        `SHOW STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Max_used_connections')`
      ),
    ]);
    const flat = Object.fromEntries(
      [...vars, ...status].map((r) => [r.Variable_name, r.Value])
    );
    database = { ...flat, poolLimit: POOL_LIMIT };
  } catch (error) {
    database = { error: (error as Error).message, poolLimit: POOL_LIMIT };
  }

  return NextResponse.json({
    /*
      A real call to the model. `ok: true` here while answers still cut
      off mid-sentence means the configuration is fine and the stream is
      being severed — a different problem in a different layer.
    */
    ai,
    database,
    /*
      Cumulative since this process started. `queued` is the one that
      decides whether the pool is worth raising: it counts statements
      that began while all POOL_LIMIT connections were already busy.
    */
    pool: {
      limit: POOL_LIMIT,
      queries: dbStats.queries,
      avgMs: dbStats.queries ? Math.round((dbStats.totalMs / dbStats.queries) * 10) / 10 : 0,
      slowestMs: dbStats.slowest,
      slowestSql: dbStats.slowestSql,
      maxInFlight: dbStats.maxInFlight,
      queued: dbStats.queued,
    },
    smtp: {
      ok: smtp.ok,
      error: smtp.error ?? null,
      user: process.env.SMTP_USER ?? null,
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? "465",
      from: process.env.SMTP_FROM ?? null,
      platformEmail: platformEmail(),
      testSend: delivery ? { to: sendTo, ...delivery } : null,
    },
    google: {
      clientIdPresent: Boolean(process.env.GOOGLE_CLIENT_ID),
      clientSecretPresent: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      /*
        The exact string Google must have in "Authorised redirect URIs".
        A mismatch here — including a trailing slash or http vs https —
        is answered with redirect_uri_mismatch and nothing else.
      */
      redirectUri: redirectUri(),
      clientIdTail: process.env.GOOGLE_CLIENT_ID?.slice(-24) ?? null,
    },
    library: { dir: LIBRARY_DIR, writable: libraryWritable },
  });
}
