"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, X, Eye, EyeOff, Users } from "lucide-react";
import {
  createStudyItemAction,
  updateStudyItemAction,
  archiveStudyItemAction,
  moveStudyItemAction,
  updateStudySubjectAction,
  toggleStudySubjectPublishedAction,
  archiveStudySubjectAction,
} from "@/lib/admin/actions/study-tracking";
import type { ActionState } from "@/lib/admin/actions/videos";
import type { StudySubjectDetail, StudentProgressSummary } from "@/lib/data/study-tracking";
import type { AcademicYearOption } from "@/lib/data/academic-years";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * The admin's editor for ONE subject: its name/year/publish state, and
 * the ordered list of lessons inside it. That is the entire structure
 * the tracker has — there is intentionally no exam-date field here,
 * because the exam date belongs to each student.
 *
 * Reordering uses two arrow buttons rather than drag-and-drop: it works
 * with a keyboard and on touch, needs no library, and the action behind
 * it swaps two positions instead of rewriting the list.
 *
 * Removal ARCHIVES. Students' marks reference these lessons, so a hard
 * delete would cascade their tracking history away.
 */
export function SubjectManager({
  subject,
  years,
  students,
}: {
  subject: StudySubjectDetail;
  years: AcademicYearOption[];
  students: StudentProgressSummary[];
}) {
  const boundSubject = updateStudySubjectAction.bind(null, subject.id);
  const [subState, subAction, subPending] = useActionState<ActionState, FormData>(boundSubject, {
    error: null,
  });
  const boundItem = createStudyItemAction.bind(null, subject.id);
  const [itemState, itemAction, itemPending] = useActionState<ActionState, FormData>(boundItem, {
    error: null,
  });
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[16px] font-semibold text-text-primary-light">{subject.title}</h2>
            <Badge variant={subject.isPublished ? "teal" : "gold"}>
              {subject.isPublished ? "منشورة" : "مسودة"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await toggleStudySubjectPublishedAction(subject.id, !subject.isPublished);
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border-light px-3 py-1.5 text-[12.5px] text-text-secondary-light transition-colors hover:border-primary hover:text-primary"
            >
              {subject.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
              {subject.isPublished ? "إلغاء النشر" : "نشر للطلبة"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (!window.confirm("أرشفة هذه المادة؟ ستختفي عن الطلبة ويبقى تقدّمهم محفوظاً.")) return;
                startTransition(async () => {
                  await archiveStudySubjectAction(subject.id);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-error/30 px-3 py-1.5 text-[12.5px] text-error transition-colors hover:bg-error/10"
            >
              <Trash2 size={14} />
              أرشفة
            </button>
          </div>
        </div>

        {subState.error && (
          <p className="mt-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
            {subState.error}
          </p>
        )}
        {subState.success && (
          <p className="mt-3 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-[12.5px] text-success">
            {subState.success}
          </p>
        )}

        <form action={subAction} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input id="s-title" name="title" label="اسم المادة" defaultValue={subject.title} required />
          <Input
            id="s-desc"
            name="description"
            label="وصف مختصر"
            defaultValue={subject.description ?? ""}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="s-year" className="text-[13px] font-medium text-text-primary-light">
              السنة الدراسية
            </label>
            <select
              id="s-year"
              name="academicYearId"
              defaultValue={subject.academicYearId ?? ""}
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
            <SubmitButton size="sm" disabled={subPending}>
              {subPending ? "جارٍ الحفظ..." : "حفظ"}
            </SubmitButton>
          </div>
        </form>
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-border-light px-lg py-3.5">
          <h3 className="text-[15px] font-semibold text-text-primary-light">الدروس</h3>
          <span className="num text-[12px] text-text-muted-light">{subject.items.length} درساً</span>
        </div>

        <div className="px-lg py-3">
          {subject.items.length === 0 ? (
            <p className="py-2 text-[13px] text-text-muted-light">لا توجد دروس بعد.</p>
          ) : (
            <ul className="divide-y divide-border-light">
              {subject.items.map((item, index) => (
                <li key={item.id} className="py-2.5">
                  {editingId === item.id ? (
                    <EditItemForm
                      itemId={item.id}
                      subjectId={subject.id}
                      defaultTitle={item.title}
                      defaultMinutes={item.estimatedMinutes}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="num w-6 shrink-0 text-[12px] text-text-muted-light">
                        {index + 1}.
                      </span>
                      <span className="flex-1 text-[13.5px] text-text-primary-light">{item.title}</span>
                      {item.estimatedMinutes ? (
                        <span className="num text-[12px] text-text-muted-light">
                          {item.estimatedMinutes} د
                        </span>
                      ) : null}
                      <div className="flex items-center gap-0.5">
                        <IconBtn
                          label="أعلى"
                          disabled={isPending || index === 0}
                          onClick={() =>
                            startTransition(async () => {
                              await moveStudyItemAction(item.id, subject.id, "up");
                            })
                          }
                        >
                          <ChevronUp size={15} />
                        </IconBtn>
                        <IconBtn
                          label="أسفل"
                          disabled={isPending || index === subject.items.length - 1}
                          onClick={() =>
                            startTransition(async () => {
                              await moveStudyItemAction(item.id, subject.id, "down");
                            })
                          }
                        >
                          <ChevronDown size={15} />
                        </IconBtn>
                        <IconBtn label="تعديل" onClick={() => setEditingId(item.id)}>
                          <Pencil size={14} />
                        </IconBtn>
                        <IconBtn
                          label="حذف"
                          tone="error"
                          disabled={isPending}
                          onClick={() => {
                            if (!window.confirm(`حذف الدرس "${item.title}"؟`)) return;
                            startTransition(async () => {
                              await archiveStudyItemAction(item.id, subject.id);
                            });
                          }}
                        >
                          <Trash2 size={14} />
                        </IconBtn>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {itemState.error && (
            <p className="mt-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
              {itemState.error}
            </p>
          )}

          <form action={itemAction} className="mt-3 grid gap-2.5 sm:grid-cols-[2fr_1fr_auto]">
            <Input id="new-item-title" name="title" label="درس جديد" required />
            <Input
              id="new-item-min"
              name="estimatedMinutes"
              type="number"
              min={0}
              label="دقائق (اختياري)"
            />
            <div className="flex items-end">
              <SubmitButton size="sm" disabled={itemPending}>
                <Plus size={15} />
                إضافة
              </SubmitButton>
            </div>
          </form>
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex items-center gap-2 border-b border-border-light px-lg py-3.5">
          <Users size={17} className="text-primary" strokeWidth={1.75} />
          <h3 className="text-[15px] font-semibold text-text-primary-light">تقدّم الطلبة</h3>
        </div>
        <div className="px-lg py-3">
          {subject.items.length === 0 ? (
            <p className="py-2 text-[13px] text-text-muted-light">أضف دروساً أولاً حتى يصبح هناك ما يُقاس.</p>
          ) : students.length === 0 ? (
            <p className="py-2 text-[13px] text-text-muted-light">لم يبدأ أي طالب هذه المادة بعد.</p>
          ) : (
            <ul className="divide-y divide-border-light">
              {students.map((s) => (
                <li key={s.userId} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 truncate text-[13.5px] text-text-primary-light">{s.fullName}</span>
                  <span className="num text-[12px] text-text-muted-light">
                    {s.doneItems}/{subject.items.length}
                  </span>
                  <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-border-light">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="num w-10 shrink-0 text-left text-[12.5px] font-semibold text-text-primary-light">
                    {s.pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "error";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm p-1.5 transition-colors disabled:opacity-30 ${
        tone === "error"
          ? "text-error hover:bg-error/10"
          : "text-text-secondary-light hover:bg-bg-light hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function EditItemForm({
  itemId,
  subjectId,
  defaultTitle,
  defaultMinutes,
  onDone,
}: {
  itemId: string;
  subjectId: string;
  defaultTitle: string;
  defaultMinutes: number | null;
  onDone: () => void;
}) {
  const bound = updateStudyItemAction.bind(null, itemId, subjectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(bound, { error: null });

  return (
    <form action={formAction} className="grid gap-2.5 sm:grid-cols-[2fr_1fr_auto_auto]">
      <Input id={`e-t-${itemId}`} name="title" label="العنوان" defaultValue={defaultTitle} required />
      <Input
        id={`e-m-${itemId}`}
        name="estimatedMinutes"
        type="number"
        min={0}
        label="دقائق"
        defaultValue={defaultMinutes ?? ""}
      />
      <div className="flex items-end">
        <SubmitButton size="sm" disabled={pending}>
          حفظ
        </SubmitButton>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={onDone}
          aria-label="إلغاء"
          className="rounded-sm p-2 text-text-secondary-light hover:bg-bg-light"
        >
          <X size={16} />
        </button>
      </div>
      {state.error && <p className="col-span-full text-[12.5px] text-error">{state.error}</p>}
    </form>
  );
}
