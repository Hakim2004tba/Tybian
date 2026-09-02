"use client";

import { updateCoursePricingAction } from "@/lib/admin/actions/pricing";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";

export function PricingForm({
  courseId,
  threeMonthsPrice,
  lifetimePrice,
}: {
  courseId: string;
  threeMonthsPrice: number | null;
  lifetimePrice: number | null;
}) {
  const action = updateCoursePricingAction.bind(null, courseId);

  return (
    <AuthForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="threeMonthsPrice"
          name="threeMonthsPrice"
          type="number"
          min={0}
          step="0.01"
          label="سعر اشتراك 3 أشهر (دج)"
          defaultValue={threeMonthsPrice ?? undefined}
          required
        />
        <Input
          id="lifetimePrice"
          name="lifetimePrice"
          type="number"
          min={0}
          step="0.01"
          label="سعر الاشتراك مدى الحياة (دج)"
          defaultValue={lifetimePrice ?? undefined}
          required
        />
      </div>
      <SubmitButton variant="gold" className="mt-5 w-fit">حفظ الأسعار</SubmitButton>
    </AuthForm>
  );
}
