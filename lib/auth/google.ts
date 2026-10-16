import "server-only";
import { randomBytes, createHash } from "node:crypto";

/**
 * Google sign-in, using the OAuth 2.0 authorization-code flow.
 *
 * WHY THE CODE FLOW AND NOT THE IMPLICIT/"credential" ONE: the code is
 * exchanged for tokens by THIS server, over TLS, authenticated with the
 * client secret. Nothing sensitive passes through the browser, and the
 * token response can be trusted because of where it came from rather
 * than because of something the browser handed us.
 *
 * That last point is the reason the ID token's signature is not
 * separately verified below. Google's own documentation says a token
 * received directly from its token endpoint over a verified TLS channel
 * needs no local signature check — the channel already proves the
 * issuer. (An ID token arriving any OTHER way — from a redirect, a
 * client, a webhook — MUST be verified, and this code never accepts one
 * from such a source.)
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_STATE_COOKIE = "google_oauth_state";

/** Whether Google sign-in is wired at all. */
export function isGoogleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * The redirect URI, which must match an entry in the Google Cloud
 * console EXACTLY — scheme, host, path, no trailing slash. A mismatch
 * is Google's `redirect_uri_mismatch` error and is the single most
 * common reason this flow fails to start.
 */
export function redirectUri(): string {
  return `${siteUrl()}/api/auth/google/callback`;
}

/**
 * A random value tying the browser that STARTED the flow to the one
 * that comes back.
 *
 * Without it, an attacker can send a victim a crafted callback URL
 * carrying the attacker's own authorization code, and the victim's
 * browser silently signs in to the ATTACKER's account — after which
 * anything the victim does lands in an account the attacker controls.
 * The value is stored hashed in the cookie for the same reason session
 * ids are: a cookie is not a secret store.
 */
export function newState(): { state: string; cookieValue: string } {
  const state = randomBytes(32).toString("base64url");
  return { state, cookieValue: createHash("sha256").update(state).digest("hex") };
}

export function stateMatches(state: string, cookieValue: string): boolean {
  const expected = createHash("sha256").update(state).digest("hex");
  // Lengths are fixed hex digests here, so a plain comparison leaks
  // nothing useful; the value is also single-use and short-lived.
  return expected === cookieValue;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Ask Google to show the account chooser rather than silently
    // reusing whichever account the browser last used — students share
    // machines, and a silent sign-in to a sibling's account is a
    // confusing and privacy-unfriendly default.
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/** Exchanges the one-time code for the signed-in user's identity. */
export async function exchangeCode(code: string): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // The body can carry the client_secret back in an error echo, so
    // only the status and Google's short error code are surfaced.
    let code = "unknown_error";
    try {
      code = String(JSON.parse(body).error ?? code);
    } catch {}
    throw new Error(`Google token exchange failed (${res.status}): ${code}`);
  }

  const token = (await res.json()) as { id_token?: string };
  if (!token.id_token) throw new Error("Google returned no id_token");

  const claims = decodeIdTokenPayload(token.id_token);

  if (!claims.sub || !claims.email) {
    throw new Error("Google id_token is missing sub or email");
  }

  // `aud` must name THIS client. A token minted for another application
  // is a valid Google token and would otherwise be accepted here.
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google id_token was issued for a different client");
  }

  return {
    sub: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: claims.name ? String(claims.name) : null,
    picture: claims.picture ? String(claims.picture) : null,
  };
}

type Claims = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  aud?: string;
};

/**
 * Reads the payload of a JWT without verifying its signature.
 *
 * Safe ONLY for a token taken straight from Google's token endpoint —
 * see the header note. Never call this on a token from anywhere else.
 */
function decodeIdTokenPayload(idToken: string): Claims {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed Google id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Claims;
}
