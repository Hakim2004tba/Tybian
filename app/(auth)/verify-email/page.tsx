import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

/**
 * Landed on right after signUpAction() when Supabase's "Confirm email"
 * setting means no session was created yet — replaces the old silent
 * redirect-to-/student that used to just bounce an unconfirmed user
 * straight to /login with no explanation. The confirmation link itself
 * goes through /auth/callback (existing route), which exchanges the
 * code for a real session.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <div className="w-full max-w-[420px] text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailCheck size={26} className="text-primary" />
        </div>

        <h1 className="mt-5 text-xl">تحقق من بريدك الإلكتروني</h1>
        <p className="mt-3 text-[14.5px] text-text-secondary-light">
          أرسلنا رابط تأكيد إلى{" "}
          {email ? <span className="num font-semibold text-text-primary-light">{email}</span> : "بريدك الإلكتروني"}
          . افتح الرسالة واضغط على الرابط لتفعيل حسابك والدخول إلى تبيان.
        </p>
        <p className="mt-2 text-[13px] text-text-muted-light">
          لم تصلك الرسالة؟ تحقق من مجلد الرسائل غير المرغوبة (Spam)، أو أعد الإرسال أدناه.
        </p>

        {email && (
          <div className="mt-6">
            <ResendVerificationForm email={email} />
          </div>
        )}

        <p className="mt-8 text-[13.5px]">
          <Link href="/login" className="font-semibold text-primary">
            العودة إلى تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
