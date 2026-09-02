"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { ActionState } from "@/lib/admin/actions/courses";

type Option = { id: string; label: string };

export function CourseForm({
  action,
  teachers,
  academicYears,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  teachers: Option[];
  academicYears: Option[];
  initial?: {
    title?: string;
    slug?: string;
    teacherId?: string;
    academicYearId?: string;
    level?: string;
    description?: string;
    shortDescription?: string;
    coverUrl?: string;
    tags?: string[];
    learningOutcomes?: string[];
  };
  submitLabel: string;
}) {
  return (
    <AuthForm action={action}>
      <div className="grid gap-5 md:grid-cols-2">
        <Input id="title" name="title" label="العنوان" defaultValue={initial?.title} required />
        <Input
          id="slug"
          name="slug"
          label="الرابط (Slug)"
          placeholder="سيُولَّد تلقائياً من العنوان إذا تُرك فارغاً"
          defaultValue={initial?.slug}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="teacherId" className="text-[13.5px] font-semibold">الأستاذ</label>
          <select
            id="teacherId"
            name="teacherId"
            required
            defaultValue={initial?.teacherId ?? ""}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          >
            <option value="" disabled>اختر الأستاذ</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="academicYearId" className="text-[13.5px] font-semibold">السنة الدراسية</label>
          <select
            id="academicYearId"
            name="academicYearId"
            required
            defaultValue={initial?.academicYearId ?? ""}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          >
            <option value="" disabled>اختر السنة الدراسية</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="level" className="text-[13.5px] font-semibold">المستوى</label>
          <select
            id="level"
            name="level"
            defaultValue={initial?.level ?? "beginner"}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          >
            <option value="beginner">مبتدئ</option>
            <option value="intermediate">متوسط</option>
            <option value="advanced">متقدم</option>
          </select>
        </div>

        <Input
          id="tags"
          name="tags"
          label="الوسوم (مفصولة بفاصلة)"
          placeholder="تشريح، سنة أولى"
          defaultValue={initial?.tags?.join("، ")}
        />

        <div className="md:col-span-2">
          <ImageUploadField name="coverUrl" label="صورة الغلاف" bucket="course-covers" defaultValue={initial?.coverUrl} />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="shortDescription" className="text-[13.5px] font-semibold">
            الوصف المختصر (يظهر في البطاقات)
          </label>
          <textarea
            id="shortDescription"
            name="shortDescription"
            rows={2}
            defaultValue={initial?.shortDescription}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="learningOutcomes" className="text-[13.5px] font-semibold">
            ما سيتعلمه الطالب (سطر لكل نقطة)
          </label>
          <textarea
            id="learningOutcomes"
            name="learningOutcomes"
            rows={4}
            placeholder={"البنية التشريحية الكاملة للقلب\nمسارات الدوران الرئوي والجهازي"}
            defaultValue={initial?.learningOutcomes?.join("\n")}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="description" className="text-[13.5px] font-semibold">الوصف الكامل</label>
          <textarea
            id="description"
            name="description"
            rows={6}
            defaultValue={initial?.description}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-[11px] text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          />
        </div>
      </div>

      <SubmitButton className="mt-6 w-fit">{submitLabel}</SubmitButton>
    </AuthForm>
  );
}
