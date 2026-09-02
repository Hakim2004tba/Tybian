"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { grantEnrollmentAction, type ActionState } from "@/lib/admin/actions/users";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function GrantEnrollmentForm({
  studentId,
  courses,
}: {
  studentId: string;
  courses: { id: string; title: string }[];
}) {
  const boundAction = grantEnrollmentAction.bind(null, studentId);
  const [state, formAction] = useActionState<ActionState, FormData>(boundAction, { error: null });

  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-2 text-[15px]">
        <KeyRound size={16} />
        منح وصول لدورة
      </h3>
      <p className="mb-4 text-[12.5px] text-text-muted-light">
        يمنح الطالب وصولاً مباشراً لأي دورة بدون دفع (لدعم فني، حالات خاصة، إلخ).
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        {state.error && <p className="text-[12.5px] text-error">{state.error}</p>}
        {state.success && <p className="text-[12.5px] text-success">{state.success}</p>}

        <select
          name="courseId"
          required
          defaultValue=""
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="" disabled>
            اختر الدورة
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <select
          name="planType"
          required
          defaultValue="three_months"
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="three_months">اشتراك 3 أشهر</option>
          <option value="lifetime">اشتراك مدى الحياة</option>
        </select>

        <SubmitButton size="sm" className="w-fit">
          منح الوصول
        </SubmitButton>
      </form>
    </Card>
  );
}
