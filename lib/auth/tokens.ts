import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Single-use secrets for password reset and email verification.
 *
 * Postgres generated these with `encode(gen_random_bytes(24), 'hex')` from
 * pgcrypto; this is the same 24 random bytes from the same kind of source.
 *
 * Only the SHA-256 hash is stored (auth_tokens.token_hash). The plain
 * token exists just long enough to be put in an email. That way the token
 * table is not itself a set of working keys to every account if the
 * database is ever read — which is the whole reason it is not stored
 * plainly.
 *
 * SHA-256 rather than scrypt here on purpose: these are 192 bits of
 * randomness, not human-chosen passwords, so there is nothing to brute
 * force and no reason to pay for a slow hash on every verification.
 */

export function createToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
