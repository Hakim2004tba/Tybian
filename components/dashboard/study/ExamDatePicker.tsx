"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { setSubjectExamDateAction } from "@/lib/actions/study-progress";
import { daysUntilExam } from "@/lib/study/tracking";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * The student's own exam date for a subject.
 *
 * This is student-owned by design (study_subject_exams, migration
 * 0035): classmates can sit the same subject on different dates, and
 * the person who knows the real one is the person revising for it. No
 * admin control writes here.
 *
 * The countdown is computed from the saved date rather than stored, so
 * it can never go stale.
 */
export function ExamDatePicker({
  subjectId,
  examDate,
}: {
  subjectId: string;
  examDate: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(examDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();

  const days = daysUntilExam(examDate);

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await setSubjectExamDateAction(subjectId, next, "/dashboard/study");
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <CalendarDays size={17} className="text-secondary" strokeWidth={1.75} />
        {examDate ? (
          <>
            <span className="num text-[14px] font-semibold text-white">{examDate}</span>
            {days !== null && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11.5px] text-white/70">
                {days > 0 ? (
                  <>
                    {t.dash.exam.remaining} <span className="num">{days}</span> {t.dash.common.dayCount}
                  </>
                ) : days === 0 ? (
                  t.dash.exam.today
                ) : (
                  t.dash.exam.passed
                )}
              </span>
            )}
          </>
        ) : (
          <span className="text-[13px] text-white/55">{t.dash.exam.none}</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-white/25 px-3 py-1 text-[12px] text-white/80 transition-colors hover:bg-white/10"
        >
          {examDate ? t.dash.common.edit : t.dash.exam.setDate}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays size={17} className="text-secondary" strokeWidth={1.75} />
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 rounded-md border border-white/25 bg-white/10 px-3 text-[13px] text-white outline-none focus:border-secondary [color-scheme:dark]"
      />
      <button
        type="button"
        disabled={isPending || !value}
        onClick={() => save(value)}
        aria-label={t.dash.common.save}
        className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
      >
        <Check size={16} />
      </button>
      {examDate && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setValue("");
            save(null);
          }}
          className="rounded-md border border-white/25 px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/10"
        >
          {t.dash.exam.removeDate}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(examDate ?? "");
          setError(null);
        }}
        aria-label={t.dash.common.cancel}
        className="flex h-9 w-9 items-center justify-center rounded-md text-white/60 hover:bg-white/10"
      >
        <X size={16} />
      </button>
      {error && <span className="text-[12px] text-error">{error}</span>}
    </div>
  );
}
