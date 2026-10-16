"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { submitContactMessageAction, type ContactActionState } from "@/lib/actions/contact";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function ContactForm() {
  const { t: T } = useI18n();
  const t = T.pages.contactForm;
  const [state, formAction] = useActionState<ContactActionState, FormData>(submitContactMessageAction, {
    error: null,
  });

  if (state.success) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-6 text-center">
        <p className="text-[15px] text-success">{state.success}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <p className="text-[13.5px] text-error">{state.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="name" name="name" label={t.name} required />
        <Input id="email" name="email" type="email" label={t.email} required />
      </div>
      <Input id="subject" name="subject" label={t.subject} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-[13.5px] font-semibold">
          {t.message}
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          required
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
        />
      </div>

      <SubmitButton className="w-fit">
        <Send size={16} />
        {t.send}
      </SubmitButton>
    </form>
  );
}
