import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * "Course management according to permissions" (per the request) means:
 * a teacher only ever sees/edits courses where courses.teacher_id maps
 * back to their own teachers row. That scoping is NOT implemented here
 * via a `.eq("teacher_id", ...)` filter we could forget to add — it's
 * enforced by the `courses_teacher_manage_own` RLS policy in
 * 0009_rls_policies.sql, so even a plain `select *` below can only ever
 * return this teacher's own rows (or, for an admin account, all rows).
 */
export default async function TeacherCoursesPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, status, students_count, rating")
    .order("created_at", { ascending: false });

  return (
    <div className="bg-bg-light py-3xl">
      <Container>
        <Badge variant="violet">إدارة الدورات</Badge>
        <h1 className="mt-3">دوراتي</h1>
        <p className="mt-2 text-text-secondary-light">
          الدور: <b>{user?.role}</b> — القائمة أدناه محدودة بدورات هذا
          الحساب فقط عبر RLS، وليس عبر فلترة في الواجهة.
        </p>

        {error && (
          <Card className="mt-6 border-error/30 bg-error/5">
            <p className="text-sm text-error">تعذّر تحميل الدورات: {error.message}</p>
          </Card>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {courses?.length ? (
            courses.map((c) => (
              <Card key={c.id}>
                <h3 className="text-[16px]">{c.title}</h3>
                <div className="mt-2 flex items-center gap-3 text-[13px] text-text-muted-light">
                  <span>{c.status}</span>
                  <span>·</span>
                  <span className="num">{c.students_count} طالب</span>
                  <span>·</span>
                  <span className="num">★ {c.rating}</span>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-text-secondary-light">
                لا توجد دورات مرتبطة بهذا الحساب بعد.
              </p>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
}
