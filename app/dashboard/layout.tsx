import { requireRouteAccess } from "@/lib/auth/session";
import { StudentShell } from "@/components/dashboard/StudentShell";

/**
 * /dashboard requires any authenticated role (same "authenticated" tier
 * as /student in lib/auth/route-access.ts) — layer 2 of the same
 * defense-in-depth model as every other protected area. Unchanged.
 *
 * The shell itself now lives in components/dashboard/StudentShell.tsx,
 * because it wraps the course, article and contact pages too: a signed-in
 * student no longer gets the marketing navbar anywhere, so this rail is
 * their only navigation. See the note there.
 *
 * What stays here is the one thing that is specific to this route — the
 * access check. StudentShell guards nothing.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRouteAccess("/dashboard");
  return <StudentShell>{children}</StudentShell>;
}
