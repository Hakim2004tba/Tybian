import { HelpCircle } from "lucide-react";
import { getTeacherScope, listLessons, ownsLesson } from "@/lib/data/teacher";
import { getQuizForAdmin, optionStats, quizReady } from "@/lib/data/quiz";
import { getDictionary } from "@/lib/i18n/locale";
import { QuestionForm } from "@/components/admin/quiz/QuestionForm";
import { createTeacherQuestionAction } from "@/lib/teacher/actions/quiz";
import { TeacherQuestionCard } from "@/components/teacher/quiz/TeacherQuestionCard";

export const dynamic = "force-dynamic";

export default async function TeacherQcmPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson: requested } = await searchParams;
  const { dict } = await getDictionary();
  const t = dict.admin.quiz;

  const scope = await getTeacherScope();
  if (!scope) return null;

  const lessons = await listLessons(scope);

  /*
    A lesson id in the query string is not permission to read it. Left
    unchecked, ?lesson=<someone-else's-id> would render another
    teacher's questions — answer keys included.
  */
  const lessonId = requested && (await ownsLesson(scope, requested)) ? requested : undefined;

  const ready = await quizReady();
  const questions = lessonId ? await getQuizForAdmin(lessonId) : [];
  const stats = lessonId ? await optionStats(lessonId) : [];

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{dict.teacher.qcm.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{dict.teacher.qcm.subtitle}</p>
      {!ready && (
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px] text-text-primary-light">
          {t.notInstalled}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">{t.existing}</h2>

          {!lessonId ? (
            <form className="rounded-xl border border-border-light bg-white px-lg py-10 text-center">
              <HelpCircle size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] text-text-secondary-light">{t.pickLesson}</p>
              <select
                name="lesson"
                defaultValue=""
                className="mt-4 w-full max-w-sm rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px]"
              >
                <option value="">{t.pickLesson}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <button className="mt-3 block rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">
                {t.lesson}
              </button>
            </form>
          ) : questions.length === 0 ? (
            <p className="rounded-xl border border-border-light bg-white px-lg py-10 text-center text-[14px] text-text-secondary-light">
              {t.none}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <TeacherQuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  isFirst={i === 0}
                  isLast={i === questions.length - 1}
                  stats={stats}
                />
              ))}
            </ol>
          )}
        </section>

        <aside className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-4 text-[15px] font-semibold text-text-primary-light">{t.addQuestion}</h2>
          <QuestionForm
            lessons={lessons}
            selectedLessonId={lessonId}
            createAction={createTeacherQuestionAction}
          />
        </aside>
      </div>
    </div>
  );
}
