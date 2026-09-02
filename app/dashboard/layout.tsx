import { requireRouteAccess } from "@/lib/auth/session";

/**
 * /dashboard requires any authenticated role (same "authenticated" tier
 * as /student in lib/auth/route-access.ts) — layer 2 of the same
 * defense-in-depth model as every other protected area.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRouteAccess("/dashboard");
  return <div className="bg-bg-light">{children}</div>;
}
