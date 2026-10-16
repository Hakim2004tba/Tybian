import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { query } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getQuizForAdmin, optionStats, quizReady } from "@/lib/data/quiz";
import { getDictionary } from "@/lib/i18n/locale";
import { QuestionForm } from "@/components/admin/quiz/QuestionForm";
import { createQuestionAction } from "@/lib/admin/actions/quiz";

export const dynamic = "force-dynamic";

export default async function AdminQcmPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  await requireRouteAccess("/admin");
  const { lesson: lessonId } = await searchParams;
  const { dict } = await getDictionary();
  const t = dict.admin.quiz;

  const lessons = await query<{ id: string; title: string; course_title: string }>(
    `SELECT l.id, l.title, c.title AS course_title
       FROM lessons l
       JOIN course_sections s ON s.id = l.section_id
       JOIN courses c ON c.id = s.course_id
      WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY c.title, s.sort_order, l.sort_order
      LIMIT 500`
  );

  const options = lessons.map((l) => ({ id: l.id, label: `${l.course_title} — ${l.title}` }));

  const ready = await quizReady();
  const questions = lessonId ? await getQuizForAdmin(lessonId) : [];
  const stats = lessonId ? await optionStats(lessonId) : [];

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>
      {!ready && (
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px] text-text-primary-light">
          {t.notInstalled}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">{t.existing}</h2>

          {!lessonId ? (
            <div className="rounded-xl border border-border-light bg-white px-lg py-12 text-center">
              <HelpCircle size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] text-text-secondary-light">{t.pickLesson}</p>
              <form className="mt-4">
                <select
                  name="lesson"
                  defaultValue=""
                  className="w-full max-w-sm rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px]"
                >
                  <option value="">{t.pickLesson}</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <button className="mt-3 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">
                  {t.lesson}
                </button>
              </form>
            </div>
          ) : questions.length === 0 ? (
            <p className="rounded-xl border border-border-light bg-white px-lg py-10 text-center text-[14px] text-text-secondary-light">
              {t.none}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <li key={q.id} className="rounded-xl border border-border-light bg-white p-4">
                  <div className="flex items-start gap-2.5">
                    <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-text-primary-light">{q.stem}</p>
                      <span className="mt-1 inline-block rounded-full bg-bg-light px-2 py-0.5 text-[10.5px] text-text-muted-light">
                        {q.kind.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <ul className="mt-3 flex flex-col gap-1.5">
                    {q.options.map((o) => {
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

                  {q.explanation && (
                    <p className="mt-2.5 border-t border-border-light pt-2.5 text-[12.5px] leading-relaxed text-text-secondary-light">
                      {q.explanation}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-4 text-[15px] font-semibold text-text-primary-light">{t.addQuestion}</h2>
          <QuestionForm lessons={options} selectedLessonId={lessonId} createAction={createQuestionAction} />
        </aside>
      </div>
    </div>
  );
}
