import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileQuestion, CheckCircle2, Play } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { bankReady, subjectBySlug, listTopics } from "@/lib/data/qcm-bank";
import { QcmMark } from "@/components/qcm/QcmMark";

export const dynamic = "force-dynamic";

export default async function SubjectTopicsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: slug } = await params;
  const user = await getSessionUser();
  if (!user) notFound();
  if (!(await bankReady())) notFound();

  const subject = await subjectBySlug(slug);
  /* A "coming soon" subject is not openable by URL either. */
  if (!subject || Number(subject.is_active) !== 1) notFound();

  const { dict: t } = await getDictionary();
  const topics = await listTopics(subject.id, user.id);

  const questions = topics.reduce((sum, topic) => sum + topic.questionCount, 0);
  const mastered = topics.reduce((sum, topic) => sum + topic.masteredCount, 0);
  const overall = questions > 0 ? Math.round((mastered / questions) * 100) : 0;

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <Link
        href="/dashboard/qcm"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary-light transition hover:text-primary"
      >
        <ChevronLeft size={15} className="rtl:rotate-180" />
        {t.bank.hubTitle}
      </Link>

      {/* ---- the subject, and how far through it the student is ---- */}
      <header className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#3D1E8F] px-5 py-6 md:px-7">
        <div className="pointer-events-none absolute -end-12 -top-20 h-52 w-52 animate-drift rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <QcmMark className="h-5 w-auto text-white/55" />
            <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-white">
              {subject.name}
            </h1>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <Chip icon={<FileQuestion size={13} />} value={questions} label={t.bank.questionsWord} />
              <Chip icon={<CheckCircle2 size={13} />} value={mastered} label={t.bank.mastered} />
            </div>
          </div>

          {/* The overall ring. One number, large, because it is the
              reason a student comes back to a subject. */}
          <div className="relative h-[86px] w-[86px] shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-white/20" />
              <circle
                cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round"
                className="stroke-secondary"
                strokeDasharray={326.7}
                strokeDashoffset={326.7 * (1 - overall / 100)}
              />
            </svg>
            <span className="num absolute inset-0 flex items-center justify-center text-[19px] font-extrabold text-white">
              {overall}
              <span className="text-[11px]">%</span>
            </span>
          </div>
        </div>

        <p className="relative mt-3 text-[12px] text-white/60">{t.bank.yourProgress}</p>
      </header>

      {topics.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border-light bg-surface-light px-4 py-12 text-center text-[14px] text-text-secondary-light">
          {t.bank.noTopics}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {topics.map((topic, i) => {
            const pct =
              topic.questionCount > 0
                ? Math.round((topic.masteredCount / topic.questionCount) * 100)
                : 0;

            return (
              <li key={topic.id}>
                <Link
                  href={`/dashboard/qcm?topic=${topic.id}`}
                  className="group flex items-center gap-3.5 rounded-2xl border border-border-light bg-surface-light p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_34px_-22px_rgba(108,76,241,0.6)] md:p-4"
                >
                  {/* The topic's place in the subject, so a long list
                      stays navigable by position rather than by title. */}
                  <span className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-[13px] font-bold text-primary transition group-hover:bg-primary group-hover:text-white">
                    {i + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[14.5px] font-semibold leading-snug text-text-primary-light">
                      {topic.title}
                    </span>

                    {/* Chips, not a sentence: a run mixing Arabic words
                        with Latin numerals gets reordered by the bidi
                        algorithm and reads wrong in both languages. */}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-text-secondary-light">
                        <span className="num font-bold tabular-nums text-text-primary-light">
                          {topic.questionCount}
                        </span>{" "}
                        {t.bank.questionsWord}
                      </span>
                      {topic.masteredCount > 0 && (
                        <span className="rounded-full bg-success/12 px-2 py-0.5 text-[11px] text-success">
                          <span className="num font-bold tabular-nums">{topic.masteredCount}</span>{" "}
                          {t.bank.mastered}
                        </span>
                      )}
                    </span>

                    {/* "Answered correctly at least once" — which is
                        what a revision bank is actually measuring. */}
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </span>

                  <span className="flex shrink-0 flex-col items-center gap-1.5">
                    <span className="num text-[13px] font-bold text-primary">{pct}%</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                      <Play size={13} fill="currentColor" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12px] text-white/80 backdrop-blur-sm">
      {icon}
      <span className="num font-bold tabular-nums text-white">{value}</span>
      {label}
    </span>
  );
}
