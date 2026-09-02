"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendBroadcastNotificationAction, type ActionState } from "@/lib/admin/actions/listings";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function BroadcastForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(sendBroadcastNotificationAction, {
    error: null,
  });

  return (
    <Card>
      <h3 className="mb-4 text-[15px]">إرسال إشعار جماعي</h3>
      <form action={formAction} className="flex flex-col gap-4">
        {state.error && <p className="text-[13px] text-error">{state.error}</p>}
        {state.success && <p className="text-[13px] text-success">{state.success}</p>}

        <Input id="title" name="title" label="عنوان الإشعار" required />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="body" className="text-[13.5px] font-semibold">نص الإشعار (اختياري)</label>
          <textarea
            id="body"
            name="body"
            rows={3}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="audience" className="text-[13.5px] font-semibold">الجمهور</label>
          <select
            id="audience"
            name="audience"
            defaultValue="active"
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary"
          >
            <option value="active">الطلاب النشطون فقط (لديهم اشتراك ساري)</option>
            <option value="all">كل الطلاب</option>
          </select>
        </div>

        <SubmitButton className="w-fit">
          <Send size={15} />
          إرسال
        </SubmitButton>
      </form>
    </Card>
  );
}
