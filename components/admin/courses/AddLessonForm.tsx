"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addLessonAction } from "@/lib/admin/actions/lessons";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AddLessonForm({ sectionId, courseId }: { sectionId: string; courseId: string }) {
  const [open, setOpen] = useState(false);
  const action = addLessonAction.bind(null, sectionId, courseId);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-fit border-dashed"
      >
        <Plus size={15} />
        إضافة درس (فيديو)
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border-light p-4">
      <p className="mb-3 text-[12.5px] text-text-muted-light">
        أنشئ الدرس أولاً، ثم ستظهر خانة رفع الفيديو مباشرة أسفله.
      </p>
      <AuthForm action={action}>
        <Input id="title" name="title" label="عنوان الدرس" required />
        <label className="mt-3 flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="isFreePreview" className="h-4 w-4 accent-primary" />
          معاينة مجانية (Free Preview)
        </label>
        <div className="mt-3 flex gap-2">
          <SubmitButton size="sm">إضافة الدرس</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      </AuthForm>
    </div>
  );
}
