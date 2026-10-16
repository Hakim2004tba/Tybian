"use client";

import { useActionState } from "react";
import { addSubjectAction, type ImportState } from "@/lib/admin/actions/qcm-import";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initial: ImportState = { error: null };

/**
 * Lists a subject before its questions exist.
 *
 * A student who opens QCM and finds one subject assumes that is all
 * there will be; the full list says what is coming.
 */
export function AddSubjectForm() {
  const [state, action] = useActionState(addSubjectAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl border border-border-light bg-white p-3.5">
      <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
        <span className="text-[12.5px] text-text-secondary-light">اسم المادّة</span>
        <input
          name="name"
          required
          placeholder="Anatomie"
          className="rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        />
      </label>
      <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
        <span className="text-[12.5px] text-text-secondary-light">المُعرّف</span>
        <input
          name="slug"
          required
          placeholder="anatomie"
          className="num rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        />
      </label>
      <SubmitButton className="!w-fit !px-4 !py-2 !text-[13px]">أضف</SubmitButton>
      {state.error && <p className="w-full text-[12.5px] text-error">{state.error}</p>}
    </form>
  );
}
