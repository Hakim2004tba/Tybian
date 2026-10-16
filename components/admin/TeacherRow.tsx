"use client";

import { useState, useTransition, useActionState } from "react";
import { GraduationCap, Pencil, Trash2 } from "lucide-react";
import { updateTeacherAction, deleteTeacherAction, type ActionState } from "@/lib/admin/actions/teachers";
import { PromoteToAdminButton } from "@/components/admin/PromoteToAdminButton";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ShareForm } from "@/components/admin/teachers/ShareForm";

export type TeacherRowData = {
  id: string;
  profileId: string;
  title: string | null;
  specialty: string | null;
  institution: string | null;
  bio: string | null;
  rating: number;
  students_count: number;
  courses_count: number;
  /** Successful payments only — admin grants and full coupons excluded. */
  revenue: number;
  paidOrders: number;
  /** The agreed cut, and what it comes to. Null before migration 20. */
  earnings: {
    percent: number;
    grossSales: number;
    payout: number;
    platform: number;
    sales: number;
  } | null;
  lastSaleAt: string | null;
  fullName: string;
  avatarUrl: string | null;
};

export function TeacherRow({ teacher }: { teacher: TeacherRowData }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const boundAction = updateTeacherAction.bind(null, teacher.id, teacher.profileId);
  const [state, formAction] = useActionState<ActionState, FormData>(boundAction, { error: null });

  function handleDelete() {
    if (!window.confirm(`حذف الأستاذ "${teacher.fullName}"؟`)) return;
    startTransition(async () => {
      const result = await deleteTeacherAction(teacher.id);
      if (result?.error) window.alert(result.error);
    });
  }

  if (editing) {
    return (
      <Card className="border-primary/30">
        <form action={formAction}>
          {state.error && <p className="mb-3 text-[12.5px] text-error">{state.error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id={`name-${teacher.id}`} name="fullName" label="الاسم الكامل" defaultValue={teacher.fullName} required />
            <Input id={`title-${teacher.id}`} name="title" label="اللقب الوظيفي" defaultValue={teacher.title ?? ""} />
            <Input id={`spec-${teacher.id}`} name="specialty" label="التخصص" defaultValue={teacher.specialty ?? ""} />
            <Input id={`inst-${teacher.id}`} name="institution" label="المؤسسة" defaultValue={teacher.institution ?? ""} />
          </div>
          <div className="mt-3">
            <ImageUploadField name="avatarUrl" label="الصورة الشخصية" bucket="avatars" defaultValue={teacher.avatarUrl} />
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <label className="text-[13.5px] font-semibold">نبذة</label>
            <textarea
              name="bio"
              rows={2}
              defaultValue={teacher.bio ?? ""}
              className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <SubmitButton size="sm">حفظ</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-2 text-[13px] text-text-muted-light">
              إلغاء
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className={pending ? "opacity-60" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap size={16} />
          </div>
          <div>
            <div className="font-medium">{teacher.fullName}</div>
            {teacher.title && <div className="text-[12px] text-text-muted-light">{teacher.title}</div>}
          </div>
        </div>

        <div className="num flex items-center gap-4 text-[12.5px] text-text-muted-light">
          <span>{teacher.courses_count} دورة</span>
          <span className="font-semibold text-text-primary-light">
            {teacher.students_count} طالب
          </span>
          <span>★ {Number(teacher.rating).toFixed(1)}</span>

          {/*
            THE MONEY, and what it deliberately excludes.

            Successful payments only. A student given access by an admin
            or a full-discount coupon produces an enrolment and no
            payment, so free access never inflates this — which is the
            distinction that makes the number usable for settling with a
            teacher rather than merely impressive.
          */}
          <span className="num font-semibold text-success">
            {new Intl.NumberFormat("en-US").format(teacher.revenue)} دج
          </span>
          <span className="num">{teacher.paidOrders} عملية</span>
          {teacher.lastSaleAt && (
            <span className="num text-text-muted-light">
              آخر بيع: {new Intl.DateTimeFormat("ar-DZ", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(new Date(teacher.lastSaleAt))}
            </span>
          )}
        </div>

        {/* What this teacher is owed, and the percentage it comes from.
            Uses its own figure rather than `revenue` above: that one
            reads payments.course_id only, which misses every pack and
            basket sale — see lib/data/teacher-earnings.ts. */}
        {teacher.earnings && (
          <ShareForm
            teacherId={teacher.id}
            percent={teacher.earnings.percent}
            grossSales={teacher.earnings.grossSales}
            payout={teacher.earnings.payout}
            platform={teacher.earnings.platform}
            sales={teacher.earnings.sales}
          />
        )}

        <div className="flex items-center gap-2">
          <PromoteToAdminButton userId={teacher.profileId} userName={teacher.fullName} />
          <button onClick={() => setEditing(true)} className="text-text-muted-light hover:text-primary" aria-label="تعديل">
            <Pencil size={15} />
          </button>
          <button onClick={handleDelete} disabled={pending} className="text-text-muted-light hover:text-error" aria-label="حذف">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </Card>
  );
}
