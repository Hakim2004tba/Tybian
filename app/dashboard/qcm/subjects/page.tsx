import { notFound } from "next/navigation";
import { Layers, FileQuestion } from "lucide-react";
import { getDictionary } from "@/lib/i18n/locale";
import { bankReady, listSubjects } from "@/lib/data/qcm-bank";
import { SubjectCard } from "@/components/qcm/SubjectCard";
import { QcmMark } from "@/components/qcm/QcmMark";

export const dynamic = "force-dynamic";

/**
 * The question bank, by subject.
 *
 * Subjects with no questions yet are SHOWN, marked "coming soon" — a
 * student who opens the bank and finds one subject assumes that is all
 * there will ever be. The full list says what is coming, which is the
 * same reason the empty academic years are listed.
 */
export default async function QcmBankPage() {
  if (!(await bankReady())) notFound();

  const { dict: t } = await getDictionary();
  const subjects = await listSubjects();

  const ready = subjects.filter((s) => s.isActive);
  const questions = ready.reduce((sum, s) => sum + s.questionCount, 0);
  const topics = ready.reduce((sum, s) => sum + s.topicCount, 0);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      {/* ---- the purple band, the same one the session opens with ---- */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#3D1E8F] px-5 py-6 md:px-7 md:py-7">
        <div className="pointer-events-none absolute -end-12 -top-20 h-52 w-52 animate-drift rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-12 h-44 w-44 animate-drift rounded-full bg-secondary/20 blur-3xl [animation-delay:-9s]" />

        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
          <QcmMark className="h-8 w-auto text-white" title={t.bank.hubTitle} />
          <span className="hidden h-7 w-px bg-white/25 sm:block" />

          {/* Counts as separate chips rather than one sentence: a line
              mixing Arabic words with Latin numerals gets reordered by
              the bidi algorithm and reads wrong in both languages. */}
          <div className="flex flex-wrap gap-2">
            <Chip icon={<FileQuestion size={13} />} value={questions} label={t.bank.questionsWord} />
            <Chip icon={<Layers size={13} />} value={topics} label={t.bank.topicsWord} />
          </div>
        </div>

        <p className="relative mt-3 max-w-xl text-[13px] leading-relaxed text-white/75">
          {t.bank.hubSubtitle}
        </p>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject, i) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            index={i}
            labels={{
              questions: t.bank.questionsWord,
              topics: t.bank.topicsWord,
              comingSoon: t.bank.comingSoon,
              inPreparation: t.bank.inPreparation,
            }}
          />
        ))}
      </div>
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
