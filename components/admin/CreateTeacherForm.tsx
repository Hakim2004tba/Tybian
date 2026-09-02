"use client";

import { useActionState, useState } from "react";
import { UserPlus, Copy, Check } from "lucide-react";
import { createTeacherAction, type CreateTeacherState } from "@/lib/admin/actions/teachers";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

export function CreateTeacherForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateTeacherState, FormData>(createTeacherAction, {
    error: null,
  });
  const [copied, setCopied] = useState(false);

  if (state.credentials) {
    return (
      <Card className="border-success/30 bg-success/5">
        <p className="text-[14px] font-semibold text-success">{state.success}</p>
        <p className="mt-2 text-[13px] text-text-secondary-light">
          شارك بيانات الدخول هذه مع الأستاذ (كلمة المرور تظهر مرة واحدة فقط) — ننصحه بتغييرها عبر
          "نسيت كلمة المرور" عند أول تسجيل دخول.
        </p>
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-border-light bg-surface-light p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-muted-light">البريد الإلكتروني</span>
            <span className="num text-[13.5px] font-medium">{state.credentials.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-muted-light">كلمة المرور المؤقتة</span>
            <div className="flex items-center gap-2">
              <span className="num rounded-sm bg-bg-light px-2 py-1 text-[13px]">{state.credentials.tempPassword}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(state.credentials!.tempPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-text-muted-light hover:text-primary"
                aria-label="نسخ"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
          إضافة أستاذ آخر
        </Button>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus size={16} />
        أستاذ جديد
      </Button>
    );
  }

  return (
    <Card className="max-w-xl">
      <h3 className="mb-4 text-[15px]">إضافة أستاذ جديد</h3>
      <form action={formAction} className="flex flex-col gap-4">
        {state.error && <p className="text-[13px] text-error">{state.error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="fullName" name="fullName" label="الاسم الكامل" required />
          <Input id="email" name="email" type="email" label="البريد الإلكتروني" required />
          <Input id="title" name="title" label="اللقب الوظيفي" placeholder="أستاذ التشريح" />
          <Input id="specialty" name="specialty" label="التخصص" />
          <Input id="institution" name="institution" label="المؤسسة" className="sm:col-span-2" />
        </div>

        <ImageUploadField name="avatarUrl" label="الصورة الشخصية (اختياري)" bucket="avatars" />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bio" className="text-[13.5px] font-semibold">نبذة (اختياري)</label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  );
}
