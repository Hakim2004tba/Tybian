"use client";

import { useActionState } from "react";
import { setTeacherShareAction, type ShareState } from "@/lib/admin/actions/teacher-share";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initial: ShareState = { error: null };

/**
 * The teacher's percentage, and what it works out to.
 *
 * The figures beside the input are the point of it: a percentage on
 * its own tells an admin nothing about whether the arrangement is
 * right, and the number they actually care about is what gets paid.
 */
export function ShareForm({
  teacherId,
  percent,
  grossSales,
  payout,
  platform,
  sales,
}: {
  teacherId: string;
  percent: number;
  grossSales: number;
  payout: number;
  platform: number;
  sales: number;
}) {
  const action = setTeacherShareAction.bind(null, teacherId);
  const [state, formAction] = useActionState(action, initial);
  const money = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="mt-3 rounded-xl border border-border-light bg-bg-light p-3.5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Figure label="مبيعات (مدفوعة فقط)" value={money(grossSales)} hint={`${sales} عملية`} />
        <Figure label="حصّة الأستاذ" value={money(payout)} accent />
        <Figure label="تبقى للمنصّة" value={money(platform)} />
      </div>

      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`pct-${teacherId}`} className="text-[12.5px] text-text-secondary-light">
          نسبة الأستاذ
        </label>
        <input
          id={`pct-${teacherId}`}
          name="percent"
          type="number"
          min={0}
          max={100}
          step="0.5"
          defaultValue={percent}
          className="num w-24 rounded-lg border border-border-light bg-surface-light px-3 py-1.5 text-[13.5px] outline-none focus:border-primary"
        />
        <span className="text-[12.5px] text-text-secondary-light">%</span>
        <SubmitButton className="!w-fit !px-3 !py-1.5 !text-[12.5px]">حفظ</SubmitButton>
      </form>

      {state.error && <p className="mt-2 text-[12px] text-error">{state.error}</p>}
      {state.success && <p className="mt-2 text-[12px] text-success">{state.success}</p>}

      <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted-light">
        المبيعات المدفوعة فقط — لا تشمل ما منحتَه مجّاناً. وما يُباع ضمن باقة أو
        مجموعة دورات يُقسَّم بين الأساتذة بنسبة أسعار دوراتهم.
      </p>
    </div>
  );
}

function Figure({
  label, value, hint, accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-light px-3 py-2">
      <div className="text-[11.5px] text-text-muted-light">{label}</div>
      <div
        className={
          "num text-[15px] font-bold " + (accent ? "text-primary" : "text-text-primary-light")
        }
      >
        {value}
      </div>
      {hint && <div className="num text-[11px] text-text-muted-light">{hint}</div>}
    </div>
  );
}
