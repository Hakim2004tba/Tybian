"use client";

import { updateProfileAction } from "@/lib/auth/actions";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import type { AcademicYearOption } from "@/lib/data/academic-years";

export function ProfileForm({
  fullName,
  phone,
  academicYearId,
  academicYears,
}: {
  fullName: string;
  phone: string | null;
  academicYearId: string | null;
  academicYears: AcademicYearOption[];
}) {
  return (
    <AuthForm action={updateProfileAction}>
      <div className="flex flex-col gap-4">
        <Input id="fullName" name="fullName" label="الاسم الكامل" defaultValue={fullName} required />
        <Input id="phone" name="phone" label="رقم الهاتف" defaultValue={phone ?? ""} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="academicYearId" className="text-[13.5px] font-semibold">
            السنة الدراسية
          </label>
          <select
            id="academicYearId"
            name="academicYearId"
            defaultValue={academicYearId ?? ""}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          >
            <option value="">— غير محدد —</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name_ar}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton className="mt-1 w-fit">حفظ التعديلات</SubmitButton>
      </div>
    </AuthForm>
  );
}
