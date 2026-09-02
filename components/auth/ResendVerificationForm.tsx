"use client";

import { useActionState } from "react";
import { resendVerificationEmailAction } from "@/lib/auth/actions";
import type { ActionState } from "@/lib/auth/actions";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(resendVerificationEmailAction, {
    error: null,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />
      {state.success && (
        <p className="mb-3 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success">
          {state.success}
        </p>
      )}
      <SubmitButton variant="outline" size="sm">
        إعادة إرسال رابط التحقق
      </SubmitButton>
    </form>
  );
}
