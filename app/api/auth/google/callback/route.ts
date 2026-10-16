import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { queryOne, execute, transaction, newId } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import {
  isGoogleEnabled,
  exchangeCode,
  stateMatches,
  GOOGLE_STATE_COOKIE,
} from "@/lib/auth/google";

/**
 * GET /api/auth/google/callback — where Google sends the student back.
 *
 * Three ways an account is reached, in this order:
 *
 *  1. `google_sub` already known  -> that is the account, sign in.
 *  2. The email exists with no Google link -> link it, but ONLY if
 *     Google says the address is verified (see below).
 *  3. Nothing matches -> create a new student.
 *
 * WHY step 2 INSISTS ON `email_verified`: anyone can put any address on
 * a Google account; only a verified one proves control of it. Without
 * that check, someone could create a Google account claiming a
 * student's address and be handed that student's TIBYAN account —
 * courses, payments and all — without ever knowing the password.
 */
export const dynamic = "force-dynamic";

/**
 * `detail` carries Google's own short error code — `invalid_client`,
 * `redirect_uri_mismatch`, `invalid_grant` — into the URL.
 *
 * Without it every one of those arrives as the same
 * `google_exchange_failed`, and the real reason exists only in a
 * Passenger log that nobody on a shared cPanel plan is going to read.
 * These codes are Google's public vocabulary, not secrets: they say
 * which of the three things to go and fix, and the login page shows the
 * same friendly sentence regardless.
 */
function fail(reason: string, detail?: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const suffix = detail ? `&detail=${encodeURIComponent(detail)}` : "";
  return NextResponse.redirect(`${site}/login?error=${encodeURIComponent(reason)}${suffix}`);
}

export async function GET(request: NextRequest) {
  if (!isGoogleEnabled()) return fail("google_unavailable");

  const url = new URL(request.url);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

  // The student pressed "cancel" on Google's screen, or Google refused.
  if (url.searchParams.get("error")) return fail("google_cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("google_bad_request");

  const cookieStore = await cookies();
  const expected = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  // Single-use: burn it before doing anything else, so a replayed
  // callback cannot ride the same state twice.
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (!expected || !stateMatches(state, expected)) return fail("google_state_mismatch");

  let identity;
  try {
    identity = await exchangeCode(code);
  } catch (error) {
    const message = (error as Error).message;
    console.error("[google] token exchange failed:", message);
    // The message is built in exchangeCode() from the status and
    // Google's short code only — the response body, which can echo the
    // client_secret back, never reaches it.
    return fail("google_exchange_failed", message);
  }

  try {
    // 1 — already linked.
    const linked = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE google_sub = ? LIMIT 1`,
      [identity.sub]
    );

    if (linked) {
      const alive = await queryOne<{ id: string }>(
        `SELECT id FROM profiles WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [linked.id]
      );
      if (!alive) return fail("account_disabled");

      await createSession(linked.id, request.headers.get("user-agent"));
      return NextResponse.redirect(`${site}/dashboard`);
    }

    // 2 — an account already uses this email.
    const existing = await queryOne<{ id: string; email_verified_at: string | null }>(
      `SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1`,
      [identity.email]
    );

    if (existing) {
      if (!identity.emailVerified) return fail("google_email_unverified");

      const alive = await queryOne<{ id: string }>(
        `SELECT id FROM profiles WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [existing.id]
      );
      if (!alive) return fail("account_disabled");

      await execute(
        `UPDATE users
            SET google_sub = ?,
                email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3))
          WHERE id = ? AND google_sub IS NULL`,
        [identity.sub, existing.id]
      );

      await createSession(existing.id, request.headers.get("user-agent"));
      return NextResponse.redirect(`${site}/dashboard`);
    }

    // 3 — a new student.
    if (!identity.emailVerified) return fail("google_email_unverified");

    const userId = newId();
    const fullName = identity.name?.trim() || identity.email.split("@")[0];

    await transaction(async (tx) => {
      /*
        The password hash is the same deliberately-unmatched sentinel the
        Supabase import used: `verifyPassword` checks the salt and key
        lengths before comparing, so this can never match any input.
        The account has no password until the student sets one through
        "forgot password" — it is not a weak password, it is none.
      */
      await tx.execute(
        `INSERT INTO users (id, email, google_sub, password_hash, email_verified_at)
         VALUES (?, ?, ?, 'scrypt$00$00', UTC_TIMESTAMP(3))`,
        [userId, identity.email, identity.sub]
      );
      await tx.execute(
        // academic_year_id stays NULL: Google cannot tell us which year
        // the student is in, and guessing would be worse than asking.
        // The profile page prompts for it.
        `INSERT INTO profiles (id, full_name, role, avatar_url)
         VALUES (?, ?, 'student', ?)`,
        [userId, fullName.slice(0, 191), identity.picture]
      );
    });

    await createSession(userId, request.headers.get("user-agent"));
    return NextResponse.redirect(`${site}/dashboard?welcome=1`);
  } catch (error) {
    console.error("[google] sign-in failed:", (error as Error).message);
    return fail("google_failed");
  }
}
