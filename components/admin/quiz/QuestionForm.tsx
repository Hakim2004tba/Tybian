"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import type { ActionState } from "@/lib/admin/actions/quiz";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

const initial: ActionState = { error: null };
const LETTERS = "ABCDE".split("");

export function QuestionForm({
  lessons,
  selectedLessonId,
  createAction,
}: {
  lessons: { id: string; label: string }[];
  selectedLessonId?: string;
  /*
    The action is injected rather than imported, because admins and
    teachers write questions through DIFFERENT actions: the teacher's
    one additionally proves the lesson is theirs. Importing one here
    would have quietly given whichever page used it the other's
    permissions.
  */
  createAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, action] = useActionState(createAction, initial);
  const { t: T } = useI18n();
  const t = T.admin.quiz;

  /* Five propositions is the usual QCM shape; more can be added. */
  const [count, setCount] = useState(5);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md border border-error/30 bg-error/10 px-3.5 py-2.5 text-[13.5px] text-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13.5px] text-success">
          {state.success}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lessonId" className="text-[13.5px] font-semibold">{t.lesson}</label>
        <select
          id="lessonId"
          name="lessonId"
          required
          defaultValue={selectedLessonId}
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        >
          <option value="">{t.pickLesson}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">{t.kind}</span>
        <div className="flex flex-wrap gap-4 text-[13.5px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="qcm" defaultChecked />
            {t.kindQcm}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="qcu" />
            {t.kindQcu}
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="stem" className="text-[13.5px] font-semibold">{t.stem}</label>
        <textarea
          id="stem"
          name="stem"
          rows={3}
          required
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13.5px] font-semibold">{t.options}</span>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="num w-5 shrink-0 text-[12.5px] font-bold text-text-muted-light">
              {LETTERS[i] ?? i + 1}
            </span>
            <input
              name={`option${i}`}
              placeholder={`${t.optionPlaceholder} ${LETTERS[i] ?? i + 1}`}
              className="min-w-0 flex-1 rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[14px] outline-none focus:border-primary"
            />
            <label className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-text-secondary-light">
              <input type="checkbox" name={`correct${i}`} />
              {t.markCorrect}
            </label>
          </div>
        ))}
        {count < 10 && (
          <button
            type="button"
            onClick={() => setCount((c) => c + 1)}
            className="flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-primary"
          >
            <Plus size={13} />
            {t.optionPlaceholder}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="explanation" className="text-[13.5px] font-semibold">{t.explanation}</label>
        <textarea
          id="explanation"
          name="explanation"
          rows={2}
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <SubmitButton className="w-fit">{t.addQuestion}</SubmitButton>
    </form>
  );
}
