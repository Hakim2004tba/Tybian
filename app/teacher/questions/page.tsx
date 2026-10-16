import Link from "next/link";
import { MessageSquare, ArrowLeft, Lock } from "lucide-react";
import { getTeacherScope, listQuestions } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";
import { teacherThreads } from "@/lib/data/teacher-inbox";

export const dynamic = "force-dynamic";

export default async function TeacherQuestionsPage() {
  const { dict, locale } = await getDictionary();
  const t = dict.teacher.questions;

  const scope = await getTeacherScope();
  if (!scope) return null;
  const questions = await listQuestions(scope);
  /* Empty until 21-teacher-inbox.sql is run. */
  const threads = await teacherThreads(scope.profileId);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {/*
        THE PRIVATE ONES FIRST, and marked. They reach one student
        each, so an unanswered one is somebody waiting with no other
        way to ask — unlike a public question, which a classmate may
        well answer first.
      */}
      {threads.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold text-text-primary-light">
            <Lock size={15} className="text-primary" />
            أسئلة خاصّة
          </h2>
          <ul className="flex flex-col gap-2">
            {threads.map((th) => (
              <li key={th.id}>
                <Link
                  href={`/teacher/questions/${th.id}`}
                  className={
                    "flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-primary/40 " +
                    (th.unread
                      ? "border-primary/40 bg-primary/[0.05]"
                      : "border-border-light bg-white")
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-text-primary-light">
                        {th.subject}
                      </span>
                      {th.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-text-muted-light">
                      {th.withName} · {th.courseTitle}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[11.5px] text-text-muted-light">
                    {fmt.format(new Date(th.lastMessageAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {questions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border-light bg-white px-lg py-12 text-center">
          <MessageSquare size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">{t.empty}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-border-light bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-text-primary-light">
                  {q.body}
                </p>
                <span
                  className={
                    q.reply_count === 0
                      ? "shrink-0 rounded-full bg-error/10 px-2.5 py-0.5 text-[11px] font-semibold text-error"
                      : "shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success"
                  }
                >
                  {q.reply_count === 0 ? t.unanswered : t.answered}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-text-muted-light">
                <span>
                  {q.student_name} · {t.on} <span className="text-text-secondary-light">{q.lesson_title}</span>
                  {" · "}
                  <span className="num">{fmt.format(new Date(`${q.created_at.replace(" ", "T")}Z`))}</span>
                </span>

                {/*
                  Straight to the lesson's discussion tab, where the
                  teacher already has a reply box and the badge that
                  marks their answer as the teacher's. Rebuilding a
                  second reply form here would mean two places to keep
                  correct.
                */}
                <Link
                  href={`/courses/${q.course_slug}/learn?lesson=${q.lesson_id}`}
                  className="flex items-center gap-1.5 font-semibold text-primary"
                >
                  {t.answer}
                  <ArrowLeft size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
