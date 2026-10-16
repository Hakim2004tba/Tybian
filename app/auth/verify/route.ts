import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { siteUrl } from "@/lib/mail";
import { createSession } from "@/lib/auth/session";
import { headers } from "next/headers";

/**
 * Confirms an email address from the link in the verification message.
 *
 * This link is now what opens the FIRST session: registration no longer
 * signs anybody in, so confirming the address and being let in are the
 * same act. Opening it on a different device than the one that
 * registered therefore signs that device in, which is the behaviour
 * people expect from a link mailed to them.
 *
 * A bad, used or expired token still hands out nothing at all.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  /*
    THE SITE'S OWN ADDRESS, never the request's.

    `new URL(request.url).origin` looked right and was wrong. Behind
    Passenger the process binds to 0.0.0.0:3000 (see app.js), so the URL
    Next reconstructs for the request is http://0.0.0.0:3000 — and every
    redirect out of this route sent the student to an address that
    exists on no machine they own. A confirmation link that ends in
    "This site can't be reached" reads as a broken platform at the exact
    moment someone is joining it.

    siteUrl() is the same function that BUILDS the link in the mail, so
    the two cannot disagree.
  */
  const origin = siteUrl().replace(/\/+$/, "");
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=verify_failed`);
  }

  const row = await queryOne<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM auth_tokens
      WHERE token_hash = ? AND purpose = 'email_verify'
        AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)`,
    [hashToken(token)]
  );

  if (!row) {
    return NextResponse.redirect(`${origin}/login?error=verify_expired`);
  }

  await execute(`UPDATE users SET email_verified_at = UTC_TIMESTAMP(3) WHERE id = ?`, [row.user_id]);
  await execute(`UPDATE auth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?`, [row.id]);

  /*
    The token is marked used BEFORE the session is issued, so a link that
    leaks later cannot be replayed into a second session.
  */
  await createSession(row.user_id, (await headers()).get("user-agent"));

  return NextResponse.redirect(`${origin}/dashboard?verified=1`);
}
