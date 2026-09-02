import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAcademicYears } from "@/lib/data/academic-years";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/student/ProfileForm";
import { ChangePasswordForm } from "@/components/student/ChangePasswordForm";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function ProfilePage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  // RLS (0009_rls_policies.sql, profiles_select_own_or_admin) guarantees
  // this only ever returns the caller's own row, or every row for admins
  // — never another student's data — regardless of what id we filter by.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, academic_year_id")
    .eq("id", user!.id)
    .single();

  const academicYears = await getAcademicYears();

  return (
    <div className="bg-bg-light py-3xl">
      <Container width="reading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1>الملف الشخصي</h1>
          <SignOutButton />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="mb-4">المعلومات الشخصية</h3>
            <ProfileForm
              fullName={profile?.full_name ?? ""}
              phone={profile?.phone ?? null}
              academicYearId={profile?.academic_year_id ?? null}
              academicYears={academicYears}
            />
          </Card>

          <Card>
            <h3 className="mb-4">تغيير كلمة المرور</h3>
            <ChangePasswordForm />
          </Card>
        </div>
      </Container>
    </div>
  );
}
