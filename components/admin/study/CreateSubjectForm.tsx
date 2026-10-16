"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createStudySubjectAction } from "@/lib/admin/actions/study-tracking";
import type { ActionState } from "@/lib/admin/actions/videos";
import type { AcademicYearOption } from "@/lib/data/academic-years";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * Creating a subject. Academic year is optional: leaving it empty makes
 * the subject visible to every student once published (see
 * can_view_study_subject, migration 0035), which is the right default
 * for a single shared syllabus.
 */
export function CreateSubjectForm({ years }: { years: AcademicYearOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createStudySubjectAction, {
    error: null,
  });

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-text-primary-light">إنشاء مادة جديدة</h2>

      {state.error && (
        <p className="mt-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-3 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-[12.5px] text-success">
          {state.success}
        </p>
      )}

      <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Input id="n-title" name="title" label="اسم المادة" placeholder="فيزيولوجيا مرضية" required />
        <Input id="n-desc" name="description" label="وصف مختصر (اختياري)" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-year" className="text-[13px] font-medium text-text-primary-light">
            السنة الدراسية (اختياري)
          </label>
          <select
            id="n-year"
            name="academicYearId"
            defaultValue=""
            className="h-10 rounded-md border border-border-light bg-surface-light px-3 text-[14px] text-text-primary-light outline-none focus:border-primary"
          >
            <option value="">كل السنوات</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name_ar}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <SubmitButton size="sm" disabled={pending}>
            <Plus size={15} />
            {pending ? "جارٍ الإنشاء..." : "إنشاء المادة"}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
