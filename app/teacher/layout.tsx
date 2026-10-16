import { requireRouteAccess } from "@/lib/auth/session";
import { TeacherShell } from "@/components/teacher/TeacherShell";

/**
 * /teacher/** requires role teacher OR admin (canAccessPath's "teacher"
 * tier). A student hitting this route is redirected to /unauthorized by
 * this guard even if middleware.ts were somehow bypassed.
 *
 * The guard here is the tier check only. WHICH courses a teacher may
 * see is a separate question, answered once in lib/data/teacher.ts —
 * being a teacher does not mean seeing every teacher's work.
 *
 * The chrome moved to TeacherShell, which renders the SAME sidebar and
 * topbar as the student dashboard rather than an imitation of them.
 */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireRouteAccess("/teacher");
  return <TeacherShell>{children}</TeacherShell>;
}
