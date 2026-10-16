"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { markLessonCompleteAction } from "@/lib/actions/lesson-progress";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * THE BUG THIS FIXES: the completed flag used to be `useState(isCompleted)`.
 * `useState` reads its argument only on a component's FIRST render, and
 * moving between lessons does not remount this button — the learn page
 * stays mounted and only its props change. So the flag stayed `true`
 * from the previous lesson: an unfinished lesson opened already wearing
 * "تم إكمال الدرس", and because the button is disabled while done, the
 * student could not mark the new lesson complete at all. Progress froze
 * silently.
 *
 * The fix is to stop storing the answer and derive it. `isCompleted`
 * comes from the server on every render and is always about the lesson
 * currently on screen; the only thing worth remembering locally is the
 * click that has not been reflected back yet — and that is remembered
 * WITH the lesson it belongs to, so it cannot leak onto the next one.
 */
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
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  // Optimistic, but only for the lesson that was actually clicked.
  const done = isCompleted || justCompletedId === lessonId;

  function handleClick() {
    if (done) return;
    startTransition(async () => {
      const result = await markLessonCompleteAction(lessonId, courseSlug);
      if (!result.error) {
        setJustCompletedId(lessonId);
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
      {done ? t.learn.completed : t.learn.markComplete}
    </button>
  );
}
