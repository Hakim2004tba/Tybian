import { resetPasswordAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Lock } from "lucide-react";

/**
 * Reached via the link in the password-reset email.
 *
 * The token arrives as a query parameter and is passed straight through
 * to the action in a hidden field. There is no session here and no
 * signing in: `resetPasswordAction` validates the token itself, against
 * its stored hash, and that token alone is the authority to set a new
 * password. Which is why it is single-use and expires in an hour.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <div className="w-full max-w-[400px]">
        <h2>تعيين كلمة مرور جديدة</h2>
        <p className="mt-1.5 text-[14.5px] text-text-secondary-light">
          اختر كلمة مرور جديدة لحسابك في تبيان.
        </p>

        <AuthForm action={resetPasswordAction} className="mt-6">
          <input type="hidden" name="token" value={token ?? ""} />
          <div className="flex flex-col gap-4">
            <Input
              id="password"
              name="password"
              type="password"
              label="كلمة المرور الجديدة"
              placeholder="8 أحرف على الأقل"
              icon={<Lock size={16} />}
              minLength={8}
              required
            />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="تأكيد كلمة المرور"
              placeholder="أعد كتابة كلمة المرور"
              icon={<Lock size={16} />}
              minLength={8}
              required
            />
            <SubmitButton className="w-full justify-center">تعيين كلمة المرور</SubmitButton>
          </div>
        </AuthForm>
      </div>
    </div>
  );
}
