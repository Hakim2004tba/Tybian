"use client";

import { useActionState, useState } from "react";
import { createCouponAction, type ActionState } from "@/lib/admin/actions/promo";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

const initial: ActionState = { error: null };

export function CouponForm({
  courses,
  packs = [],
}: {
  courses: { id: string; title: string }[];
  packs?: { id: string; title: string }[];
}) {
  const [state, action] = useActionState(createCouponAction, initial);
  const { t: T } = useI18n();
  const [scope, setScope] = useState<"all" | "courses" | "packs">("all");
  const t = T.admin.promo;

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
        <label htmlFor="code" className="text-[13.5px] font-semibold">{t.code}</label>
        <input
          id="code"
          name="code"
          required
          placeholder="CLUB20"
          /* Uppercased as it is typed, so what the admin sees on screen
             is what a student will have to enter. */
          style={{ textTransform: "uppercase" }}
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
        <span className="text-[12px] text-text-muted-light">{t.codeHint}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">{t.type}</span>
        <div className="flex flex-wrap gap-4 text-[13.5px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="discountType" value="percentage" defaultChecked />
            {t.percentage}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="discountType" value="fixed" />
            {t.fixed}
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="discountValue" className="text-[13.5px] font-semibold">{t.value}</label>
        <input
          id="discountValue"
          name="discountValue"
          type="number"
          min={1}
          required
          className="num rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="maxUses" className="text-[13.5px] font-semibold">{t.maxUses}</label>
        <input
          id="maxUses"
          name="maxUses"
          type="number"
          min={1}
          className="num rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="expiresAt" className="text-[13.5px] font-semibold">{t.expiresAt}</label>
        <input
          id="expiresAt"
          name="expiresAt"
          type="date"
          className="num rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      {/* WHERE THE CODE WORKS.

          Three buttons rather than a checkbox, because the states are
          genuinely three and "not courses" does not mean "packs". */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">أين يُستعمل؟</span>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "كل شيء"],
            ["courses", "الدورات فقط"],
            ["packs", "الباقات فقط"],
          ] as const).map(([value, label]) => (
            <label
              key={value}
              className={
                "cursor-pointer rounded-xl border px-3.5 py-2 text-[13px] transition " +
                (scope === value
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border-light text-text-secondary-light hover:border-primary/40")
              }
            >
              <input
                type="radio"
                name="scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* A single pack, when the scope is packs. */}
      {scope === "packs" && packs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="packId" className="text-[13.5px] font-semibold">الباقة</label>
          <select
            id="packId"
            name="packId"
            defaultValue=""
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
          >
            <option value="">أي باقة</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* A single course — hidden when the code is for packs, since
          naming both is refused by the action anyway. */}
      <div className={"flex flex-col gap-1.5" + (scope === "packs" ? " hidden" : "")}>
        <label htmlFor="courseId" className="text-[13.5px] font-semibold">{t.course}</label>
        <select
          id="courseId"
          name="courseId"
          defaultValue=""
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        >
          <option value="">{t.anyCourse}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      <SubmitButton className="w-fit">{t.create}</SubmitButton>
    </form>
  );
}
