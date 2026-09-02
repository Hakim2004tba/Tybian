import { resetPasswordAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Lock } from "lucide-react";

/**
 * Reached via the link in the password-reset email. Supabase's
 * @supabase/ssr cookie handler exchanges the recovery token for a
 * temporary session automatically when this page loads (through
 * middleware.ts calling `getUser()`), so `resetPasswordAction` can call
 * `auth.updateUser()` directly without re-collecting the old password.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <div className="w-full max-w-[400px]">
        <h2>تعيين كلمة مرور جديدة</h2>
        <p className="mt-1.5 text-[14.5px] text-text-secondary-light">
          اختر كلمة مرور جديدة لحسابك في تبيان.
        </p>

        <AuthForm action={resetPasswordAction} className="mt-6">
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
