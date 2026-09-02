"use client";

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { editSectionAction, deleteSectionAction, reorderSectionAction } from "@/lib/admin/actions/sections";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { LessonRow, type LessonRowData } from "@/components/admin/courses/LessonRow";
import { AddLessonForm } from "@/components/admin/courses/AddLessonForm";
import { cn } from "@/lib/utils";

export function SectionBlock({
  section,
  courseId,
  isFirst,
  isLast,
}: {
  section: { id: string; title: string; sort_order: number; lessons: LessonRowData[] };
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function runAction(fn: () => Promise<{ error: string | null }>) {
    startTransition(() => {
      fn().then((result) => {
        if (result?.error) window.alert(result.error);
      });
    });
  }

  function reorder(direction: "up" | "down") {
    runAction(() => reorderSectionAction(courseId, section.id, direction));
  }

  function handleDelete() {
    if (!window.confirm(`حذف القسم "${section.title}" وكل دروسه؟`)) return;
    runAction(() => deleteSectionAction(section.id, courseId));
  }

  return (
    <Card padded={false} className={cn(pending && "opacity-60")}>
      <div className="flex items-center gap-3 border-b border-border-light p-4">
        <div className="flex flex-col">
          <button disabled={isFirst} onClick={() => reorder("up")} aria-label="نقل القسم لأعلى" className="text-text-muted-light hover:text-primary disabled:opacity-30">
            <ChevronUp size={16} />
          </button>
          <button disabled={isLast} onClick={() => reorder("down")} aria-label="نقل القسم لأسفل" className="text-text-muted-light hover:text-primary disabled:opacity-30">
            <ChevronDown size={16} />
          </button>
        </div>

        {editing ? (
          <div className="flex-1">
            <AuthForm action={editSectionAction.bind(null, section.id, courseId)}>
              <div className="flex items-center gap-2">
                <Input id={`title-${section.id}`} name="title" defaultValue={section.title} required className="flex-1" />
                <SubmitButton size="sm">حفظ</SubmitButton>
                <button type="button" onClick={() => setEditing(false)} className="px-2 text-[13px] text-text-muted-light">
                  إلغاء
                </button>
              </div>
            </AuthForm>
          </div>
        ) : (
          <>
            <h3 className="flex-1 text-[15.5px]">{section.title}</h3>
            <span className="num text-[12.5px] text-text-muted-light">{section.lessons.length} درس</span>
            <button onClick={() => setEditing(true)} aria-label="تعديل القسم" className="text-text-muted-light hover:text-primary">
              <Pencil size={15} />
            </button>
            <button onClick={handleDelete} aria-label="حذف القسم" className="text-text-muted-light hover:text-error">
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1 p-2">
        {section.lessons.map((lesson, i) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            sectionId={section.id}
            courseId={courseId}
            isFirst={i === 0}
            isLast={i === section.lessons.length - 1}
          />
        ))}
        <div className="px-1 py-1">
          <AddLessonForm sectionId={section.id} courseId={courseId} />
        </div>
      </div>
    </Card>
  );
}
