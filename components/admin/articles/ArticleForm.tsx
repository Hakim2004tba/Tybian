"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import type { ActionState } from "@/lib/admin/actions/articles";

export function ArticleForm({
  action,
  submitLabel,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  initial?: {
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: string;
    coverUrl?: string;
  };
}) {
  return (
    <AuthForm action={action}>
      <div className="grid gap-5 md:grid-cols-2">
        <Input id="title" name="title" label="العنوان" defaultValue={initial?.title} required />
        <Input
          id="slug"
          name="slug"
          label="الرابط (Slug)"
          placeholder="يُولَّد تلقائياً من العنوان إذا تُرك فارغاً"
          defaultValue={initial?.slug}
        />

        <div className="md:col-span-2">
          <ImageUploadField name="coverUrl" label="صورة الغلاف (اختياري)" bucket="course-covers" defaultValue={initial?.coverUrl} />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="excerpt" className="text-[13.5px] font-semibold">
            مقتطف قصير (يظهر في قائمة المقالات)
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={2}
            defaultValue={initial?.excerpt}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="body" className="text-[13.5px] font-semibold">
            محتوى المقال
          </label>
          <textarea
            id="body"
            name="body"
            rows={14}
            required
            defaultValue={initial?.body}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
          />
        </div>
      </div>

      <SubmitButton className="mt-6 w-fit">{submitLabel}</SubmitButton>
    </AuthForm>
  );
}
