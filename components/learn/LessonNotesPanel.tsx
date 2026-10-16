"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Check } from "lucide-react";
import { saveLessonNoteAction } from "@/lib/actions/lesson-notes";
import { useI18n } from "@/lib/i18n/I18nProvider";

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
  const { t } = useI18n();

  /*
    Reset everything when the panel is pointed at a different lesson.

    THE BUG THIS FIXES: `useState(initialBody)` reads its argument only
    on the first render, and moving between lessons does not remount
    this panel — the learn page stays mounted and only the props change.
    The textarea therefore kept showing the PREVIOUS lesson's notes.

    That was not just a display problem. With an edit still inside the
    1200ms debounce, navigating away left `body` holding the old text
    while `lessonId` had already become the new lesson — so the pending
    save wrote the previous lesson's notes onto the new one, and lost
    the edit that was meant for the old one. Two lessons damaged by one
    keystroke and a fast click.

    This is React's documented "adjust state during render" reset: it
    runs before anything is committed or any effect fires, so the stale
    save is cancelled rather than merely overwritten afterwards.
  */
  const [renderedLessonId, setRenderedLessonId] = useState(lessonId);
  if (lessonId !== renderedLessonId) {
    setRenderedLessonId(lessonId);
    setBody(initialBody);
    setStatus("idle");
    lastSavedRef.current = initialBody;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

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
          {t.learn.notes.title}
        </h3>
        <span className="flex items-center gap-1 text-[12px] text-text-muted-dark">
          {status === "saving" && t.learn.notes.saving}
          {status === "saved" && (
            <>
              <Check size={13} className="text-success" /> {t.learn.notes.saved}
            </>
          )}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        placeholder={t.learn.notes.placeholder}
        className="w-full rounded-md border border-border-dark bg-surface-dark px-3.5 py-3 text-[14px] leading-relaxed text-text-primary-dark outline-none placeholder:text-text-muted-dark focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.15)]"
      />
    </div>
  );
}
