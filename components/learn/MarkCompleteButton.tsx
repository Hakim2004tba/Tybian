"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { markLessonCompleteAction } from "@/lib/actions/lesson-progress";
import { cn } from "@/lib/utils";

export function MarkCompleteButton({
  lessonId,
  courseSlug,
  isCompleted,
}: {
  lessonId: string;
  courseSlug: string;
  isCompleted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(isCompleted);
  const router = useRouter();

  function handleClick() {
    if (done) return;
    startTransition(async () => {
      const result = await markLessonCompleteAction(lessonId, courseSlug);
      if (!result.error) {
        setDone(true);
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending || done}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md border px-4 py-2 text-[13.5px] font-medium transition-colors",
        done
          ? "border-success/30 bg-success/10 text-success"
          : "border-primary/40 text-primary hover:bg-primary/10"
      )}
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
      {done ? "تم إكمال الدرس" : "تحديد كمكتمل"}
    </button>
  );
}
