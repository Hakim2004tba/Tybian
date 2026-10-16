"use client";

import { useActionState } from "react";
import { createPackAction, type ActionState } from "@/lib/admin/actions/packs";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

const initial: ActionState = { error: null };

export function PackForm({ courses }: { courses: { id: string; title: string; price: number | null }[] }) {
  const [state, action] = useActionState(createPackAction, initial);
  const { t: T } = useI18n();
  const t = T.admin.packs;

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md border border-error/30 bg-error/10 px-3.5 py-2.5 text-[13.5px] text-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13.5px] text-success">
          {state.success}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-[13.5px] font-semibold">{t.packTitle}</label>
        <input
          id="title"
          name="title"
          required
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-[13.5px] font-semibold">{t.description}</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="price" className="text-[13.5px] font-semibold">{t.price}</label>
        <input
          id="price"
          name="price"
          type="number"
          min={1}
          step={1}
          required
          className="num rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">{t.courses}</span>
        <span className="text-[12px] text-text-muted-light">{t.coursesHint}</span>
        {/* Each course shows its own price, so the admin can see what
            they are discounting against while choosing. */}
        <div className="mt-1 flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-md border border-border-light p-2">
          {courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="courseIds" value={c.id} />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              {c.price !== null && (
                <span className="num shrink-0 text-[11.5px] text-text-muted-light">{c.price}</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <SubmitButton className="w-fit">{t.create}</SubmitButton>
    </form>
  );
}
