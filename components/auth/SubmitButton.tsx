"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? t.pages.submitting : children}
    </Button>
  );
}
