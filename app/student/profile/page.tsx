import { queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getAcademicYears } from "@/lib/data/academic-years";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/student/ProfileForm";
import { ChangePasswordForm } from "@/components/student/ChangePasswordForm";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function ProfilePage() {
  const user = await getSessionUser();
  // `id = ?` bound to the session's own user is now the only thing
  // scoping this read. profiles_select_own_or_admin used to guarantee it
  // "regardless of what id we filter by"; it does not exist any more, so
  // the id must come from the session and never from the URL.
  const profile = await queryOne<{
    full_name: string;
    phone: string | null;
    academic_year_id: string | null;
  }>(
    `SELECT full_name, phone, academic_year_id FROM profiles WHERE id = ?`,
    [user!.id]
  );

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
