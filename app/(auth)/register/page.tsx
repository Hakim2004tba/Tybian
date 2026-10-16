import Link from "next/link";
import { signUpAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { getAcademicYears } from "@/lib/data/academic-years";
import { getDictionary } from "@/lib/i18n/locale";
import { GoogleButton } from "@/components/auth/GoogleButton";

/**
 * Public self-registration always creates a `student` account — the
 * `handle_new_auth_user` DB trigger hardcodes role='student' regardless
 * of anything submitted here, so there is no client-editable field that
 * could grant teacher/admin access. Teacher and admin accounts are
 * created by an admin (see /admin/students in a later phase).
 */
export default async function RegisterPage() {
  const academicYears = await getAcademicYears();
  const { locale, dict } = await getDictionary();

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <div className="w-full max-w-[420px]">
        <h2>{dict.auth.registerTitle}</h2>
        <p className="mt-1.5 text-[14.5px] text-text-secondary-light">{dict.auth.registerSubtitle}</p>

        <AuthForm action={signUpAction} className="mt-6">
          <div className="flex flex-col gap-4">
            <Input
              id="fullName"
              name="fullName"
              label={dict.auth.fullName}
              placeholder={locale === "ar" ? "مثال: أحمد بلقاسمي" : "e.g. Ahmed Belkacemi"}
              required
            />
            <Input id="email" name="email" type="email" label={dict.auth.email} placeholder="you@example.com" required />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="academicYearId" className="text-[13.5px] font-semibold">
                {dict.auth.academicYear}
              </label>
              <select
                id="academicYearId"
                name="academicYearId"
                required
                defaultValue=""
                className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] text-text-primary-light outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
              >
                <option value="" disabled>
                  {locale === "ar" ? "اختر السنة الدراسية" : "Select your academic year"}
                </option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {locale === "en" && y.name_en ? y.name_en : y.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <Input
              id="password"
              name="password"
              type="password"
              label={dict.auth.password}
              placeholder={locale === "ar" ? "8 أحرف على الأقل" : "At least 8 characters"}
              required
              minLength={8}
            />

            <SubmitButton className="mt-2 w-full justify-center">{dict.auth.registerButton}</SubmitButton>
          </div>
        </AuthForm>

        <GoogleButton />

        <p className="mt-6 text-center text-[14px]">
          {dict.auth.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-primary">
            {locale === "ar" ? "سجّل الدخول" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
