"use client";

import { updateCoursePricingAction } from "@/lib/admin/actions/pricing";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { PlanBlock } from "@/components/admin/PlanBlock";

/**
 * The two plans a course is sold under — both of them yours to set.
 *
 * Neither slot is "the lifetime one". A course can be three months and
 * a year, a month and six months, or anything else; lifetime is a
 * checkbox on either, not a fixed second option. The first version
 * assumed otherwise because the database column is called `lifetime`,
 * which is a slot name, not a promise.
 */
export function PricingForm({
  courseId,
  threeMonthsPrice,
  lifetimePrice,
  durationDays,
  lifetimeDurationDays,
}: {
  courseId: string;
  threeMonthsPrice: number | null;
  lifetimePrice: number | null;
  /** null means the row predates 10-plan-duration.sql. */
  durationDays: number | null;
  lifetimeDurationDays: number | null;
}) {
  const action = updateCoursePricingAction.bind(null, courseId);

  return (
    <AuthForm action={action}>
      <PlanBlock
        title="الخطّة الأولى"
        priceName="threeMonthsPrice"
        daysName="planADays"
        lifetimeName="planALifetime"
        defaultPrice={threeMonthsPrice}
        /*
          Falls back to 90 rather than to lifetime. A course priced
          before the duration column existed has nothing stored, and
          defaulting to "forever" would give away permanent access to a
          plan someone paid three months for.
        */
        defaultDays={durationDays ?? 90}
      />

      <div className="my-5 h-px bg-border-light" />

      <PlanBlock
        title="الخطّة الثانية"
        priceName="lifetimePrice"
        daysName="planBDays"
        lifetimeName="planBLifetime"
        defaultPrice={lifetimePrice}
        /* This slot WAS lifetime for every existing course, so that is
           what it has to keep meaning until an admin says otherwise. */
        defaultDays={lifetimeDurationDays}
      />

      <SubmitButton variant="gold" className="mt-5 w-fit">حفظ الأسعار</SubmitButton>
    </AuthForm>
  );
}
