import { queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getAcademicYears } from "@/lib/data/academic-years";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/student/ProfileForm";
import { ChangePasswordForm } from "@/components/student/ChangePasswordForm";
import { AvatarUpload } from "@/components/student/AvatarUpload";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The profile INSIDE the student shell.
 *
 * /student/profile still exists and still works (old links, bookmarks),
 * but the sidebar now points here so editing your profile no longer
 * drops you out of the dashboard into the marketing layout.
 *
 * The same two forms are reused as-is — this page is chrome only. The
 * sign-out button is not repeated: the sidebar already carries one, and
 * two of them on the same screen is noise.
 */
export default async function DashboardProfilePage() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  // profiles_select_own_or_admin used to guarantee this returned the
  // caller's own row "regardless of the id filtered on". It does not
  // exist any more, so the id must come from the session — never a URL.
  const profile = await queryOne<{
    full_name: string;
    phone: string | null;
    academic_year_id: string | null;
    avatar_url: string | null;
  }>(
    `SELECT full_name, phone, academic_year_id, avatar_url FROM profiles WHERE id = ?`,
    [user!.id]
  );

  const academicYears = await getAcademicYears();

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary-light">{t.profile.title}</h1>
        <p className="mt-1 text-[13.5px] text-text-secondary-light">
          {t.profile.subtitle}
        </p>
      </header>

      <Card className="mt-6">
        <AvatarUpload
          currentUrl={profile?.avatar_url ?? null}
          userId={user!.id}
          fullName={profile?.full_name ?? ""}
        />
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-[15px] font-semibold">{t.profile.personalInfo}</h3>
          <ProfileForm
            fullName={profile?.full_name ?? ""}
            phone={profile?.phone ?? null}
            academicYearId={profile?.academic_year_id ?? null}
            academicYears={academicYears}
          />
        </Card>

        <Card>
          <h3 className="mb-4 text-[15px] font-semibold">{t.profile.changePassword}</h3>
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
