"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Adding a lesson (and attaching its video — the two are one action, see
 * AddLessonForm/VideoUploadForm) always belongs to a specific course's
 * section, so there's no standalone "/admin/lessons/new" — but every
 * other admin list page has a prominent "+" button in its header, and
 * this one didn't, which made the add-lesson entry point genuinely hard
 * to find. This gives /admin/lessons and /admin/videos that same
 * prominent "+" affordance, one click away from the real form.
 */
export function JumpToCourseStructure({
  courses,
  label,
}: {
  courses: { id: string; title: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const router = useRouter();

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-light bg-surface-light p-3">
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        className="rounded-sm border border-border-light bg-bg-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
      >
        <option value="" disabled>
          اختر الدورة أولاً
        </option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={!courseId}
        onClick={() => courseId && router.push(`/admin/courses/${courseId}/structure`)}
      >
        متابعة
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[12.5px] text-text-muted-light hover:text-primary"
      >
        إلغاء
      </button>
    </div>
  );
}
