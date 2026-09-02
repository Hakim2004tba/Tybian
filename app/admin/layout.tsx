import { requireRouteAccess } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

/**
 * /admin/** requires role === 'admin' exactly (canAccessPath's "admin"
 * tier) — teachers are rejected here too, not just students. This is the
 * layout half of the guarantee tested in tests/route-access.test.ts.
 *
 * The shell below (sidebar + topbar) reuses the exact same design tokens
 * as the rest of the app — dark sidebar, light content surface, same
 * card/radius/shadow system from DESIGN_SYSTEM.md. No admin-specific
 * palette or component language is introduced.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRouteAccess("/admin");

  return (
    <div className="flex min-h-screen bg-bg-light">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <AdminTopbar name="مدير المنصة" email={user.email} />
        <div className="p-md lg:p-xl">{children}</div>
      </div>
    </div>
  );
}
