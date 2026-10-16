import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * TIBYAN — password hashing.
 *
 * scrypt from Node's own crypto, not bcrypt or argon2. Those are the
 * better-known choices and both need a native module compiled with
 * node-gyp; on jailed cPanel hosting that build fails as often as it
 * succeeds, and when it fails it fails at deploy time on the server. This
 * is memory-hard, built in, and has nothing to compile.
 *
 * Supabase Auth hashed passwords with bcrypt and never exposed them, so
 * existing passwords cannot be carried over: every account has to reset.
 * See the migration notes.
 */

const KEYLEN = 64;
const SALT_BYTES = 16;

/** `scrypt$<salt hex>$<hash hex>` — the salt travels with the hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Compares in constant time.
 *
 * A plain `===` on the hashes leaks, through how long the comparison
 * takes, how many leading bytes were correct — which is enough to
 * reconstruct a hash byte by byte. Every early return below happens
 * before any secret is involved, so none of them leak anything.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;

  const actual = await scrypt(password, salt, KEYLEN);
  return timingSafeEqual(actual, expected);
}
