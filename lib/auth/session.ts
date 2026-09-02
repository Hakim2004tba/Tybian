import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessPath, getRedirectFor, type AppRole } from "@/lib/auth/route-access";

export type SessionUser = {
  id: string;
  email: string | null;
  role: AppRole;
};

/**
 * Reads the current user + role from the verified Supabase session.
 * Uses `getUser()` (not `getSession()`) because getUser() re-validates
 * the JWT against Supabase Auth on every call instead of trusting an
 * unverified cookie payload — required for any server-side authorization
 * decision (see Supabase docs on getUser vs getSession).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // role is synced into app_metadata by the `sync_profile_role_to_jwt`
  // trigger (0007_functions_and_triggers.sql) whenever profiles.role
  // changes, so it's available here without an extra query.
  const role = (user.app_metadata?.role as AppRole | undefined) ?? "student";

  return { id: user.id, email: user.email ?? null, role };
}

/**
 * Server-side guard for use at the top of protected layouts/pages.
 * This is the SECOND enforcement layer (middleware is the first) —
 * defense in depth per the architecture doc's three-layer authorization
 * model. A layout that forgets this call is still protected by
 * middleware; a request that somehow skips middleware is still caught
 * here; and either way, the database itself is protected by RLS.
 *
 * Usage: `const user = await requireRole(request-path-prefix);`
 */
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

  // canAccessPath(null, ...) is only true for public paths, so if we
  // reach here on a protected path, user is guaranteed non-null.
  return user as SessionUser;
}
