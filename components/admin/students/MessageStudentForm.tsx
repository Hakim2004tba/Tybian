"use client";

import { useActionState, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { messageStudentAction, type MessageState } from "@/lib/admin/actions/message-student";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initial: MessageState = { error: null };

/** A private message to this one student — bell, and optionally email. */
export function MessageStudentForm({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const action = messageStudentAction.bind(null, studentId);
  const [state, formAction] = useActionState(action, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-border-light bg-white px-3.5 py-2 text-[13px] font-semibold text-text-secondary-light transition hover:border-primary/40 hover:text-primary"
      >
        <MessageSquare size={15} />
        راسل {studentName.split(" ")[0]}
      </button>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border border-border-light bg-white p-4">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-text-primary-light">
        <MessageSquare size={15} className="text-primary" />
        رسالة إلى {studentName}
      </h3>

      <input
        name="subject"
        required
        maxLength={191}
        placeholder="العنوان"
        className="mt-3 w-full rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
      />
      <textarea
        name="body"
        required
        rows={5}
        placeholder="نصّ الرسالة…"
        className="mt-2 w-full resize-y rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-primary"
      />

      <label className="mt-2.5 flex items-center gap-2 text-[13px] text-text-secondary-light">
        <input type="checkbox" name="alsoEmail" defaultChecked className="h-4 w-4 accent-primary" />
        أرسل بريداً أيضاً
      </label>

      {state.error && <p className="mt-2 text-[12.5px] text-error">{state.error}</p>}
      {state.success && <p className="mt-2 text-[12.5px] text-success">{state.success}</p>}

      <div className="mt-3 flex items-center gap-2">
        <SubmitButton className="!w-fit !px-4 !py-2 !text-[13px]">
          <Send size={14} /> إرسال
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-text-muted-light hover:text-text-primary-light"
        >
          إغلاق
        </button>
      </div>
    </form>
  );
}
