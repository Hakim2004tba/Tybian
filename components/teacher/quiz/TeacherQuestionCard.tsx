"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Circle, Pencil, Trash2, ChevronUp, ChevronDown, Plus, X } from "lucide-react";
import {
  updateTeacherQuestionAction,
  deleteTeacherQuestionAction,
  moveTeacherQuestionAction,
  type ActionState,
} from "@/lib/teacher/actions/quiz";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

const LETTERS = "ABCDEFGHIJ".split("");
const initial: ActionState = { error: null };

type Option = { id: string; body: string; isCorrect: boolean };
type Question = { id: string; kind: "qcm" | "qcu"; stem: string; explanation: string | null; options: Option[] };
type Stat = { option_id: string; picks: number };

/**
 * One question in the teacher's QCM list — readable, editable, movable,
 * removable.
 *
 * Teachers could previously only ADD. A typo in a stem, a wrong answer
 * key, or a question that turned out to be unfair meant asking an admin,
 * which in practice meant leaving it wrong. Everything an admin can do
 * to a question on their own lesson, a teacher can now do to theirs —
 * the actions behind these buttons prove ownership of the LESSON THE
 * QUESTION BELONGS TO, not merely of some lesson the form names.
 *
 * The edit form is the same shape as the create form, pre-filled. It is
 * deliberately not extracted into one shared component: create posts a
 * lesson id and this does not, create resets and this must keep what
 * was typed when the server rejects it, and folding both into one
 * component with flags is how a form starts writing to the wrong row.
 */
export function TeacherQuestionCard({
  question,
  index,
  isFirst,
  isLast,
  stats,
}: {
  question: Question;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  stats: Stat[];
}) {
  const { t: T } = useI18n();
  const t = T.admin.quiz;

  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateTeacherQuestionAction, initial);
  const [pending, startTransition] = useTransition();

  /*
    Closing on success is driven by the action's own result rather than
    by an effect watching it: the card must stay open while the server
    is rejecting the form, or the teacher loses the text they typed
    along with the message telling them why.
  */
  if (editing && state.success) {
    setEditing(false);
  }

  const [count, setCount] = useState(Math.max(question.options.length, 2));

  function remove() {
    if (!window.confirm(t.confirmDelete)) return;
    startTransition(() => {
      void deleteTeacherQuestionAction(question.id);
    });
  }

  function move(direction: "up" | "down") {
    startTransition(() => {
      void moveTeacherQuestionAction(question.id, direction);
    });
  }

  return (
    <li className="rounded-xl border border-border-light bg-white p-4">
      <div className="flex items-start gap-2.5">
        <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-text-primary-light">{question.stem}</p>
          <span className="mt-1 inline-block rounded-full bg-bg-light px-2 py-0.5 text-[10.5px] text-text-muted-light">
            {question.kind.toUpperCase()}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={t.moveUp} disabled={isFirst || pending} onClick={() => move("up")}>
            <ChevronUp size={15} />
          </IconButton>
          <IconButton label={t.moveDown} disabled={isLast || pending} onClick={() => move("down")}>
            <ChevronDown size={15} />
          </IconButton>
          <IconButton
            label={editing ? t.cancelEdit : t.editQuestion}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <X size={15} /> : <Pencil size={14} />}
          </IconButton>
          <IconButton label={t.deleteQuestion} disabled={pending} danger onClick={remove}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>

      {!editing && (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {question.options.map((o) => {
              const stat = stats.find((s) => s.option_id === o.id);
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-light px-3 py-2 text-[13px]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {o.isCorrect ? (
                      <CheckCircle2 size={14} className="shrink-0 text-success" />
                    ) : (
                      <Circle size={14} className="shrink-0 text-text-muted-light" />
                    )}
                    <span className="truncate text-text-secondary-light">{o.body}</span>
                  </span>
                  {stat && stat.picks > 0 && (
                    <span className="num shrink-0 text-[11.5px] text-text-muted-light">
                      {stat.picks} {t.picks}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {question.explanation && (
            <p className="mt-2.5 border-t border-border-light pt-2.5 text-[12.5px] leading-relaxed text-text-secondary-light">
              {question.explanation}
            </p>
          )}
        </>
      )}

      {editing && (
        <form action={action} className="mt-4 flex flex-col gap-4 border-t border-border-light pt-4">
          <input type="hidden" name="questionId" value={question.id} />

          {state.error && (
            <p className="rounded-md border border-error/30 bg-error/10 px-3.5 py-2.5 text-[13.5px] text-error">
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">{t.kind}</span>
            <div className="flex flex-wrap gap-4 text-[13.5px]">
              <label className="flex items-center gap-2">
                <input type="radio" name="kind" value="qcm" defaultChecked={question.kind === "qcm"} />
                {t.kindQcm}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="kind" value="qcu" defaultChecked={question.kind === "qcu"} />
                {t.kindQcu}
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">{t.stem}</span>
            <textarea
              name="stem"
              rows={3}
              required
              defaultValue={question.stem}
              className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-semibold">{t.options}</span>
            {Array.from({ length: count }).map((_, i) => {
              const existing = question.options[i];
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="num w-5 shrink-0 text-[12.5px] font-bold text-text-muted-light">
                    {LETTERS[i] ?? i + 1}
                  </span>
                  <input
                    name={`option${i}`}
                    defaultValue={existing?.body ?? ""}
                    placeholder={`${t.optionPlaceholder} ${LETTERS[i] ?? i + 1}`}
                    className="min-w-0 flex-1 rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[14px] outline-none focus:border-primary"
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-text-secondary-light">
                    <input
                      type="checkbox"
                      name={`correct${i}`}
                      defaultChecked={existing?.isCorrect ?? false}
                    />
                    {t.markCorrect}
                  </label>
                </div>
              );
            })}
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
            <span className="text-[13.5px] font-semibold">{t.explanation}</span>
            <textarea
              name="explanation"
              rows={2}
              defaultValue={question.explanation ?? ""}
              className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <SubmitButton className="w-fit">{t.saveQuestion}</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-3 py-2 text-[13px] text-text-secondary-light hover:text-text-primary-light"
            >
              {t.cancelEdit}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        "flex h-7 w-7 items-center justify-center rounded-md border border-border-light transition disabled:cursor-not-allowed disabled:opacity-35 " +
        (danger
          ? "text-error hover:border-error/40 hover:bg-error/10"
          : "text-text-secondary-light hover:border-primary/40 hover:bg-primary/5 hover:text-primary")
      }
    >
      {children}
    </button>
  );
}
