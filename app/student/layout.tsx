import { requireRouteAccess } from "@/lib/auth/session";

/**
 * /student/** is open to ANY authenticated role (student/teacher/admin)
 * per canAccessPath's "authenticated" tier — a teacher or admin browsing
 * their own learning dashboard isn't blocked, only guests are.
 *
 * This layout-level check is redundant with middleware.ts by design —
 * see lib/auth/session.ts doc comment for why that redundancy is
 * intentional (defense in depth).
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRouteAccess("/student");
  return <>{children}</>;
}
