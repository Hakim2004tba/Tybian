"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { grantEnrollmentAction, type ActionState } from "@/lib/admin/actions/users";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { describeDuration } from "@/lib/plans/duration";

export function GrantEnrollmentForm({
  studentId,
  courses,
}: {
  studentId: string;
  /* Each course carries the length of its two plans, so the labels
     below can say what the grant will actually do. */
  courses: { id: string; title: string; planADays: number | null; planBDays: number | null }[];
}) {
  const boundAction = grantEnrollmentAction.bind(null, studentId);
  const [state, formAction] = useActionState<ActionState, FormData>(boundAction, { error: null });
  const [courseId, setCourseId] = useState("");
  const selected = courses.find((c) => c.id === courseId);

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
          onChange={(e) => setCourseId(e.target.value)}
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

        {/*
          The two plan labels follow the COURSE that is selected.

          They were fixed strings — "اشتراك 3 أشهر" and "اشتراك مدى
          الحياة" — written when those were the only two possibilities.
          An admin who set a course to six months still read "3 أشهر"
          here and granted something the label denied. The labels are
          now built from each course's stored durations.
        */}
        <select
          name="planType"
          required
          defaultValue="three_months"
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="three_months">
            اشتراك {describeDuration(selected?.planADays ?? 90, "ar")}
          </option>
          <option value="lifetime">
            اشتراك {describeDuration(selected?.planBDays ?? null, "ar")}
          </option>
        </select>

        <SubmitButton size="sm" className="w-fit">
          منح الوصول
        </SubmitButton>
      </form>
    </Card>
  );
}
