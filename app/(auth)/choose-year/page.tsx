import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getSessionUser, getSessionProfile } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { setAcademicYearAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * The one question a Google sign-up never got asked.
 *
 * Reached only when a student has no academic year — the shell sends
 * them here and will not render until it is answered. Anyone who
 * already has one is bounced straight back, so this cannot be used to
 * change a year later; that belongs on the profile page, where it is an
 * edit rather than a gate.
 */
export default async function ChooseYearPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const profile = await getSessionProfile();
  if (profile?.academic_year_id) redirect("/dashboard");

  const { dict, locale } = await getDictionary();
  const years = await query<{ id: string; name_ar: string; name_en: string | null }>(
    `SELECT id, name_ar, name_en FROM academic_years ORDER BY sort_order ASC`
  );

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <div className="w-full max-w-[420px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <GraduationCap size={26} className="text-primary" />
        </div>

        <h1 className="mt-5 text-center text-xl">{dict.auth.academicYear}</h1>
        <p className="mt-3 text-center text-[14.5px] leading-relaxed text-text-secondary-light">
          {locale === "ar"
            ? "اختر سنتك الدراسية لنعرض لك دروس سنتك ومواد زملائك. خطوة واحدة، ثمّ تدخل مباشرة."
            : "Pick your year so we can show you your own material and your classmates' garden. One step, then you are in."}
        </p>

        <div className="mt-6">
          <AuthForm action={setAcademicYearAction}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="academicYearId" className="text-[13.5px] font-semibold">
                {dict.auth.academicYear}
              </label>
              <select
                id="academicYearId"
                name="academicYearId"
                required
                defaultValue=""
                className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] text-text-primary-light outline-none focus:border-primary"
              >
                <option value="" disabled>
                  {locale === "ar" ? "اختر السنة الدراسية" : "Select your academic year"}
                </option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {locale === "en" && y.name_en ? y.name_en : y.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton className="mt-5 w-full justify-center">
              {locale === "ar" ? "متابعة" : "Continue"}
            </SubmitButton>
          </AuthForm>
        </div>
      </div>
    </div>
  );
}
