import "server-only";
import { headers } from "next/headers";

/**
 * A small in-process limiter for the CPU-expensive auth paths.
 *
 * WHY THIS EXISTS. Signing in costs a full scrypt hash — measured at
 * ~76 ms of CPU on a fast laptop, and this runs on shared hosting
 * where it will be slower. The sign-in action deliberately hashes even
 * when the email does not exist, so that a wrong address and a wrong
 * password take the same time and neither can be used to discover who
 * has an account. That is the right decision, and its cost is that an
 * unauthenticated request can burn a quarter of a second of CPU. A few
 * hundred of those a minute would make every page on the site slow,
 * and nothing in the app stopped them.
 *
 * WHY IN MEMORY. The Node process persists between requests on this
 * host — verified, not assumed: /api/version reports a constant
 * startedAt with a climbing uptime. A Map is therefore enough, and a
 * Redis instance would be new infrastructure to solve a problem one
 * Map already solves.
 *
 * WHAT IT IS NOT. One process means one counter; if the app is ever
 * run with several workers each gets its own, and the effective limit
 * multiplies. That is acceptable for a brake whose job is to stop
 * runaway cost, not to enforce an exact quota.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/*
  A ceiling on the map itself. An attacker rotating IPs would otherwise
  grow it without limit — trading a CPU problem for a memory one. When
  it fills, the oldest windows go; the worst case is that an abusive
  client gets a fresh allowance sooner than it should, which is still
  far better than the unlimited situation this replaces.
*/
const MAX_TRACKED = 5000;

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  if (windows.size > MAX_TRACKED) {
    const excess = windows.size - MAX_TRACKED;
    let removed = 0;
    for (const key of windows.keys()) {
      windows.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/**
 * The caller's address, as this host presents it.
 *
 * nginx sits in front of Passenger, so the socket address is always
 * the proxy. x-forwarded-for's FIRST entry is the client; later ones
 * are proxies. It is client-supplied and therefore spoofable — which
 * is tolerable here, because the thing being protected is CPU, and an
 * attacker who rotates the header pays the cost of rotating it.
 */
async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type RateLimitVerdict = { allowed: boolean; retryAfterSeconds: number };

/**
 * Records an attempt and says whether to proceed.
 *
 * Call it BEFORE the expensive work — the point is to not do the work.
 *
 * `limit` attempts per `windowSeconds`, per bucket per address. The
 * defaults are deliberately generous: a person who has forgotten which
 * of two passwords they used, on a shared university connection, must
 * not be locked out. This is a brake on machines, not on students.
 */
export async function rateLimit(
  bucket: string,
  limit = 20,
  windowSeconds = 300,
  subject?: string
): Promise<RateLimitVerdict> {
  const now = Date.now();
  if (Math.random() < 0.02) sweep(now); // amortised cleanup, no timer

  /*
    THE SUBJECT MATTERS BECAUSE OF NAT.

    Keying on the address alone was wrong for this audience. Algerian
    mobile carriers put very many subscribers behind one public IP, and
    a university's wifi is one address for a whole building. A class
    arriving together would have shared a single budget between them,
    and the twenty-first student to sign in that window — a student who
    had done nothing wrong and typed nothing twice — would have been
    refused.

    Adding the email being attempted separates them: each account gets
    its own allowance from each address. It still stops the thing the
    brake exists for, which is one attacker grinding through passwords,
    because grinding one account is exactly what consumes one budget.
  */
  const key = subject
    ? `${bucket}:${await clientKey()}:${subject}`
    : `${bucket}:${await clientKey()}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears an address's budget after a success, so real users are never punished. */
export async function rateLimitReset(bucket: string, subject?: string): Promise<void> {
  const base = `${bucket}:${await clientKey()}`;
  windows.delete(subject ? `${base}:${subject}` : base);
}
