"use client";

import { useActionState } from "react";
import { updateSettingsAction, type ActionState } from "@/lib/admin/actions/listings";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function SettingsForm({
  settings,
}: {
  settings: {
    site_name: string;
    support_email: string | null;
    maintenance_mode: boolean;
    /** The homepage explainer, as a Vimeo link. Null before migration 21. */
    intro_video?: string | null;
  };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateSettingsAction, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <p className="text-[13px] text-error">{state.error}</p>}
      {state.success && <p className="text-[13px] text-success">{state.success}</p>}

      <Input id="site_name" name="site_name" label="اسم المنصة" defaultValue={settings.site_name} required />
      <Input id="support_email" name="support_email" type="email" label="بريد الدعم الفني" defaultValue={settings.support_email ?? ""} />

      <div>
        <Input
          id="intro_video"
          name="intro_video"
          label="فيديو التعريف في الصفحة الرئيسية"
          placeholder="https://vimeo.com/..."
          defaultValue={settings.intro_video ?? ""}
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted-light">
          الصق رابط الفيديو من Vimeo. يعمل تلقائياً وبلا صوت (المتصفّحات تمنع
          التشغيل التلقائي بصوت)، وللزائر زرّ لتشغيل الصوت. اتركه فارغاً لإخفاء
          القسم.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-[14px]">
        <input type="checkbox" name="maintenance_mode" defaultChecked={settings.maintenance_mode} className="h-4 w-4 accent-primary" />
        وضع الصيانة (يمنع الوصول للطلاب مؤقتاً)
      </label>

      <SubmitButton className="w-fit">حفظ الإعدادات</SubmitButton>
    </form>
  );
}
