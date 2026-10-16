import Link from "next/link";
import { BookOpen, Users, MessageSquare, Radio, Star, ArrowLeft } from "lucide-react";
import { queryOne } from "@/lib/db";
import { getTeacherScope, getStats, listQuestions, listCourses } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function TeacherHomePage() {
  const { dict } = await getDictionary();
  const t = dict.teacher;

  const scope = await getTeacherScope();
  if (!scope) return null;

  const [stats, questions, courses] = await Promise.all([
    getStats(scope),
    listQuestions(scope, 5),
    listCourses(scope),
  ]);

  const me = await queryOne<{ full_name: string }>(
    `SELECT full_name FROM profiles WHERE id = ? LIMIT 1`,
    [scope.profileId]
  );

  const tiles = [
    { icon: BookOpen, value: String(stats.courses), label: t.stats.courses, href: "/teacher/courses" },
    { icon: Users, value: String(stats.students), label: t.stats.students, href: "/teacher/students" },
    { icon: MessageSquare, value: String(stats.openQuestions), label: t.stats.openQuestions, href: "/teacher/questions" },
    { icon: Radio, value: String(stats.upcomingMeetings), label: t.stats.meetings, href: "/teacher/meetings" },
  ];

  return (
    /* Same page padding as every /dashboard screen — the old layout
       supplied it through Container, which the shell replaced. */
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">
        {t.welcome}, {me?.full_name ?? ""}
      </h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {courses.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border-light bg-white px-lg py-10 text-center text-[14px] text-text-secondary-light">
          {t.noCourses}
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="rounded-xl border border-border-light bg-white p-4 transition-colors hover:border-primary/40"
              >
                <tile.icon size={17} className="text-primary" strokeWidth={1.75} />
                <div className="num mt-2 text-[24px] font-bold text-text-primary-light">{tile.value}</div>
                <div className="text-[12px] leading-tight text-text-muted-light">{tile.label}</div>
              </Link>
            ))}
          </div>

          {stats.avgRating > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-text-secondary-light">
              <Star size={14} className="text-gold" fill="currentColor" />
              {t.stats.rating}: <span className="num font-semibold">{stats.avgRating.toFixed(1)}</span>
            </p>
          )}

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-text-primary-light">{t.questions.title}</h2>
              <Link href="/teacher/questions" className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                {t.nav.questions}
                <ArrowLeft size={14} />
              </Link>
            </div>

            {questions.length === 0 ? (
              <p className="rounded-xl border border-border-light bg-white px-lg py-8 text-center text-[13.5px] text-text-secondary-light">
                {t.questions.empty}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-xl border border-border-light bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[13.5px] leading-relaxed text-text-primary-light">{q.body}</p>
                      {q.reply_count === 0 && (
                        <span className="shrink-0 rounded-full bg-error/10 px-2 py-0.5 text-[10.5px] font-semibold text-error">
                          {t.questions.unanswered}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] text-text-muted-light">
                      {q.student_name} · {t.questions.on} {q.lesson_title}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
