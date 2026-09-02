"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Check } from "lucide-react";
import { saveLessonNoteAction } from "@/lib/actions/lesson-notes";

const SAVE_DEBOUNCE_MS = 1200;

/**
 * Autosaves on a debounce (not on every keystroke) — the same
 * throttling principle used for video progress (lib/video/progress-throttle.ts)
 * and study-session logging: the server only hears about a change once
 * typing pauses, never on every character.
 */
export function LessonNotesPanel({ lessonId, initialBody }: { lessonId: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialBody);

  useEffect(() => {
    if (body === lastSavedRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStatus("saving");
      saveLessonNoteAction(lessonId, body).then((result) => {
        if (!result.error) {
          lastSavedRef.current = body;
          setStatus("saved");
        }
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [body, lessonId]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[15px] text-text-primary-dark">
          <NotebookPen size={16} />
          ملاحظاتي الشخصية
        </h3>
        <span className="flex items-center gap-1 text-[12px] text-text-muted-dark">
          {status === "saving" && "جارٍ الحفظ..."}
          {status === "saved" && (
            <>
              <Check size={13} className="text-success" /> تم الحفظ
            </>
          )}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        placeholder="اكتب ملاحظاتك الخاصة حول هذا الدرس هنا — لا يراها أحد سواك..."
        className="w-full rounded-md border border-border-dark bg-surface-dark px-3.5 py-3 text-[14px] leading-relaxed text-text-primary-dark outline-none placeholder:text-text-muted-dark focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.15)]"
      />
    </div>
  );
}
