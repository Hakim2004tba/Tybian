import { requireRouteAccess } from "@/lib/auth/session";

/**
 * /teacher/** requires role teacher OR admin (canAccessPath's "teacher"
 * tier). A student hitting this route is redirected to /unauthorized by
 * this guard even if middleware.ts were somehow bypassed.
 */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireRouteAccess("/teacher");
  return <>{children}</>;
}
