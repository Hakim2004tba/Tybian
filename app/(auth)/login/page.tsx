import Link from "next/link";
import { signInAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/layout/Logo";
import { getDictionary } from "@/lib/i18n/locale";
import { Mail, Lock } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const { locale, dict } = await getDictionary();

  return (
    <div className="grid min-h-[calc(100vh-73px)] lg:grid-cols-2">
      <div className="relative hidden flex-col justify-center overflow-hidden bg-bg-dark p-16 lg:flex">
        <div className="glow-violet animate-pulse-slow" />
        <div className="relative">
          <Logo tone="dark" className="mb-10" />
          {locale === "ar" ? (
            <h1 className="max-w-md text-[34px] text-text-primary-dark">
              المعرفة اليوم،
              <br />
              طبيب <span className="text-primary">الغد</span>.
            </h1>
          ) : (
            <h1 className="max-w-md text-[34px] text-text-primary-dark">
              Today&apos;s knowledge,
              <br />
              tomorrow&apos;s <span className="text-primary">doctor</span>.
            </h1>
          )}
          <p className="mt-4 max-w-sm text-text-secondary-dark">
            {locale === "ar"
              ? "منصة متكاملة لطلبة الطب الجزائريين، من أول محاضرة تشريح إلى مناقشة التخرج."
              : "A complete platform for Algerian medical students — from your first anatomy lecture to your graduation defense."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-bg-light p-8">
        <div className="w-full max-w-[400px]">
          <h2>{dict.auth.loginTitle}</h2>
          <p className="mt-1.5 text-[14.5px] text-text-secondary-light">{dict.auth.loginSubtitle}</p>

          <AuthForm action={signInAction} className="mt-7">
            <input type="hidden" name="redirectTo" value={redirect ?? ""} />
            <div className="flex flex-col gap-4">
              <Input
                id="email"
                name="email"
                type="email"
                label={dict.auth.email}
                placeholder="you@example.com"
                icon={<Mail size={16} />}
                required
              />
              <Input
                id="password"
                name="password"
                type="password"
                label={dict.auth.password}
                placeholder="••••••••"
                icon={<Lock size={16} />}
                required
              />
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-[13px] text-primary">
                  {dict.auth.forgotPassword}
                </Link>
              </div>
              <SubmitButton className="w-full justify-center">{dict.auth.loginButton}</SubmitButton>
            </div>
          </AuthForm>

          <p className="mt-6 text-center text-[14px]">
            {dict.auth.noAccount}{" "}
            <Link href="/register" className="font-semibold text-primary">
              {dict.auth.createAccount}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
