/**
 * TIBYAN — route access policy.
 *
 * This is a pure function on purpose: `middleware.ts` and every
 * server-side layout guard (`requireRole()` in lib/auth/session.ts) both
 * call THIS function rather than re-implementing the rule. That way the
 * rule is defined exactly once and is trivially unit-testable without
 * spinning up Next.js or Supabase — see tests/route-access.test.mjs.
 *
 * IMPORTANT: this function only decides "is this navigation allowed".
 * It is NOT the security boundary by itself — the real boundary is
 * Postgres RLS (0009_rls_policies.sql) plus the server-side checks in
 * each layout/page. A bug here would be a UX annoyance (wrong redirect),
 * not a data leak, because RLS enforces the same rule again at the
 * database layer regardless of what the middleware decided.
 */

export type AppRole = "student" | "teacher" | "admin";

export type RequiredAccess = "public" | "authenticated" | "teacher" | "admin";

/**
 * Maps a pathname to the access level it requires.
 * Edit this list to add new protected areas — nothing else needs to change.
 */
export function getRequiredAccess(pathname: string): RequiredAccess {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student")) return "authenticated";
  if (pathname.startsWith("/dashboard")) return "authenticated";
  return "public";
}

/**
 * role = null means "not signed in" (guest).
 */
export function canAccessPath(role: AppRole | null, pathname: string): boolean {
  const required = getRequiredAccess(pathname);

  if (required === "public") return true;
  if (role === null) return false; // guests never pass a protected route

  switch (required) {
    case "authenticated":
      // any signed-in role (student/teacher/admin) may enter /student/**
      return true;
    case "teacher":
      // teacher-only areas: teachers AND admins (admin has full access)
      return role === "teacher" || role === "admin";
    case "admin":
      // admin-only areas: admins only — students and teachers are blocked
      return role === "admin";
  }
}

/**
 * Where to send someone who fails canAccessPath — kept separate from the
 * boolean check so tests can assert on both independently.
 */
export function getRedirectFor(role: AppRole | null, pathname: string): string {
  if (role === null) {
    const redirectParam = encodeURIComponent(pathname);
    return `/login?redirect=${redirectParam}`;
  }
  return "/unauthorized";
}
