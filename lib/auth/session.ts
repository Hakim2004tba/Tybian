import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { execute, newId, queryOne, toSql } from "@/lib/db";
import { canAccessPath, getRedirectFor, type AppRole } from "@/lib/auth/route-access";

/**
 * TIBYAN — sessions.
 *
 * Replaces Supabase Auth. The shape of what this module exports is
 * unchanged on purpose — `getSessionUser`, `requireAuth` and
 * `requireRouteAccess` keep their signatures, so every layout and page
 * that calls them needs no edit.
 *
 * What changed underneath: there is no JWT. The cookie holds an opaque
 * session id and nothing else, and each call reads the row. The old code
 * used `getUser()` over `getSession()` specifically to avoid trusting an
 * unverified cookie payload; here the cookie payload carries no claims to
 * trust in the first place. `role` comes from the profiles table on every
 * request rather than from app_metadata baked into a token, which also
 * removes the trigger that used to sync it — a demoted admin now loses
 * access on their next request instead of at their next token refresh.
 */

const COOKIE = "tibyan_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string | null;
  role: AppRole;
};

type SessionRow = {
  user_id: string;
  email: string;
  role: AppRole;
  deleted_at: string | null;
};

/**
 * The signed-in user, looked up ONCE per request.
 *
 * `cache()` is React's per-request memo: every call inside the same
 * server render returns the first call's promise. Without it this ran
 * eleven times for a single dashboard load — the root layout, the
 * route guard, the shell, the page, and each of the seven streamed
 * sections all asked independently, and each ask was a three-table
 * join (sessions → users → profiles).
 *
 * The connection pool holds five connections. Eleven identical joins
 * per page view is what turns fifty simultaneous readers into a queue;
 * one is what it should always have been. Nothing about the call sites
 * changed — they still ask whenever they need to know, which is the
 * right way to write them.
 *
 * Safe because a session cookie cannot change halfway through
 * rendering one response: sign-in and sign-out are separate requests,
 * and no code path here writes the cookie and then reads it back.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE)?.value;
  if (!sessionId) return null;

  /*
    One query for session, account and role.

    `expires_at > UTC_TIMESTAMP(3)` is what makes expiry real: the row is
    not trusted just because the cookie still carries its id. The join to
    profiles also drops anyone soft-deleted, so a withdrawn account cannot
    keep browsing on a session issued before it was closed.
  */
  const row = await queryOne<SessionRow>(
    `SELECT s.user_id, u.email, p.role, p.deleted_at
       FROM sessions s
       JOIN users    u ON u.id = s.user_id
       JOIN profiles p ON p.id = s.user_id
      WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3)`,
    [sessionId]
  );

  if (!row || row.deleted_at !== null) return null;

  return { id: row.user_id, email: row.email ?? null, role: row.role ?? "student" };
});

/**
 * Issues a session and sets the cookie. Called after a verified login.
 *
 * ONE DEVICE AT A TIME, FOR STUDENTS. Signing in anywhere ends every
 * other session on the account, so the phone that just logged in logs
 * the laptop out. That is the point: a subscription shared between
 * five classmates stops being worth sharing once only one of them can
 * be reading at a time.
 *
 * STUDENTS ONLY, deliberately. A teacher or an admin moves between a
 * desk and a phone as part of the job and gains nothing by sharing an
 * account — locking them out every time they pick up the other device
 * would be friction bought for no safety. The sharing this guards
 * against is of PAID ACCESS, which only a student has.
 *
 * Done by deleting the rows, not by marking them: `getSessionUser`
 * looks the row up on every request, so a deleted row is an immediate
 * sign-out everywhere, with no flag for a stale cache to disagree
 * about.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const id = newId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const account = await queryOne<{ role: string }>(
    `SELECT role FROM profiles WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (account?.role === "student") {
    await execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  }

  await execute(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)`,
    [id, userId, toSql(expiresAt), userAgent?.slice(0, 255) ?? null]
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, id, {
    httpOnly: true, // never readable from JavaScript, so XSS cannot steal it
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // survives a return from the payment provider; blocks CSRF
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Signs out. Deletes the row, not just the cookie — otherwise the id
 * would keep working for anyone who had already captured it.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE)?.value;

  if (sessionId) {
    await execute(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  }
  cookieStore.delete(COOKIE);
}

/** Signs out everywhere. Use after a password reset. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}

/**
 * Removes expired rows. Nothing deletes them otherwise — Supabase managed
 * that itself. Call from the analytics cron; it is cheap and indexed.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await execute(`DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(3)`);
  return result.affectedRows;
}

/* ------------------------------------------------------------------ */
/* Guards — unchanged signatures, so callers need no edit               */
/* ------------------------------------------------------------------ */

export async function requireAuth(currentPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(getRedirectFor(null, currentPath));
  }
  return user;
}

export async function requireRouteAccess(currentPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  const role = user?.role ?? null;

  if (!canAccessPath(role, currentPath)) {
    redirect(getRedirectFor(role, currentPath));
  }

  // canAccessPath(null, ...) is only true for public paths, so on a
  // protected path a non-null user is guaranteed here.
  return user as SessionUser;
}

/**
 * The signed-in user's profile row, once per request.
 *
 * Twelve places read `full_name` or `academic_year_id` off `profiles`
 * with the same `WHERE id = ?`, several of them within one render —
 * the shell and the page both wanted the name, the library page and
 * the file route both wanted the year. Same reasoning as
 * getSessionUser above: memoised, not restructured, so every caller
 * keeps asking for what it needs where it needs it.
 *
 * Returns null when signed out, so callers can stay unconditional.
 */
export type SessionProfile = {
  full_name: string;
  role: AppRole;
  avatar_url: string | null;
  academic_year_id: string | null;
};

export const getSessionProfile = cache(async function getSessionProfile(): Promise<SessionProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  return queryOne<SessionProfile>(
    `SELECT full_name, role, avatar_url, academic_year_id FROM profiles WHERE id = ?`,
    [user.id]
  );
});
