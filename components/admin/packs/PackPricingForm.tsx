"use client";

import { updatePackPricingAction } from "@/lib/admin/actions/packs";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { PlanBlock } from "@/components/admin/PlanBlock";

/**
 * The two plans a pack is sold under — the same editor the courses use.
 *
 * Deliberately the same component and the same wording: an admin who
 * has priced a course already knows how to price a pack, and a second
 * dialect for the same decision is how the two drift apart.
 */
export function PackPricingForm({
  packId,
  planAPrice,
  planADays,
  planBPrice,
  planBDays,
}: {
  packId: string;
  planAPrice: number | null;
  planADays: number | null;
  planBPrice: number | null;
  planBDays: number | null;
}) {
  const action = updatePackPricingAction.bind(null, packId);

  return (
    <AuthForm action={action}>
      <PlanBlock
        title="الخطّة الأولى"
        priceName="planAPrice"
        daysName="planADays"
        lifetimeName="planALifetime"
        defaultPrice={planAPrice}
        /*
          Falls back to 90 days rather than to lifetime. A pack whose
          second slot has never been set must not start life granting
          permanent access to every course in it.
        */
        defaultDays={planADays ?? 90}
      />

      <div className="my-5 h-px bg-border-light" />

      <PlanBlock
        title="الخطّة الثانية"
        priceName="planBPrice"
        daysName="planBDays"
        lifetimeName="planBLifetime"
        defaultPrice={planBPrice}
        /* Every pack sold before this was lifetime, so that is what
           this slot keeps meaning until an admin says otherwise. */
        defaultDays={planBDays}
      />

      <SubmitButton variant="gold" className="mt-5 w-fit">حفظ أسعار الباقة</SubmitButton>
    </AuthForm>
  );
}
