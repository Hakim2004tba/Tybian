"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addSectionAction } from "@/lib/admin/actions/sections";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AddSectionForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const action = addSectionAction.bind(null, courseId);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-fit">
        <Plus size={16} />
        إضافة قسم
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border-light p-4">
      <AuthForm action={action}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input id="title" name="title" label="عنوان القسم" placeholder="مثال: مقدمة تشريحية" required className="flex-1" />
          <div className="flex gap-2">
            <SubmitButton size="sm">إضافة</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      </AuthForm>
    </div>
  );
}
