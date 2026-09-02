import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <div className="w-full max-w-[400px]">
        <h2>استعادة كلمة المرور</h2>
        <p className="mt-1.5 text-[14.5px] text-text-secondary-light">
          أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
        </p>

        <AuthForm action={requestPasswordResetAction} className="mt-6">
          <div className="flex flex-col gap-4">
            <Input
              id="email"
              name="email"
              type="email"
              label="البريد الإلكتروني"
              placeholder="you@example.com"
              icon={<Mail size={16} />}
              required
            />
            <SubmitButton className="w-full justify-center">إرسال رابط الاستعادة</SubmitButton>
          </div>
        </AuthForm>

        <p className="mt-6 text-center text-[14px]">
          تذكّرت كلمة المرور؟{" "}
          <Link href="/login" className="font-semibold text-primary">
            سجّل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
