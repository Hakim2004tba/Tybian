"use client";

import { changePasswordAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function ChangePasswordForm() {
  const { t: T } = useI18n();
  const t = T.student;
  return (
    <AuthForm action={changePasswordAction}>
      <div className="flex flex-col gap-4">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          label={t.currentPassword}
          required
        />
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          label={t.newPassword}
          minLength={8}
          required
        />
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label={t.confirmNewPassword}
          minLength={8}
          required
        />
        <SubmitButton className="mt-1 w-fit">{t.changePassword}</SubmitButton>
      </div>
    </AuthForm>
  );
}
