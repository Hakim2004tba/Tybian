"use client";

import { changePasswordAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";

export function ChangePasswordForm() {
  return (
    <AuthForm action={changePasswordAction}>
      <div className="flex flex-col gap-4">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          label="كلمة المرور الحالية"
          required
        />
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          label="كلمة المرور الجديدة"
          minLength={8}
          required
        />
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="تأكيد كلمة المرور الجديدة"
          minLength={8}
          required
        />
        <SubmitButton className="mt-1 w-fit">تغيير كلمة المرور</SubmitButton>
      </div>
    </AuthForm>
  );
}
