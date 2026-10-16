import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import type { BankSubject } from "@/lib/data/qcm-bank";

/**
 * One subject in the QCM grid.
 *
 * TWO CARDS, NOT ONE GREYED OUT. The first version drew the same flat
 * card for both states and dimmed the unavailable one, which read as
 * a page that had failed to load rather than a subject on its way.
 *
 * The locked card is built to look like something withheld: the
 * question rows are really there, blurred behind the glass, with a
 * light sweeping across them. A student can see the shape of what is
 * coming, which is the whole point of listing it before it exists.
 */
export type SubjectLabels = {
  questions: string;
  topics: string;
  comingSoon: string;
  inPreparation: string;
};

export function SubjectCard({
  subject,
  index,
  labels,
}: {
  subject: BankSubject;
  index: number;
  /* Passed in rather than read from a hook: this is a server
     component, and useI18n only works past a client boundary. */
  labels: SubjectLabels;
}) {
  /* A different hue per card, cycling — a grid of seven identical
     violet tiles is a grid nobody's eye can navigate. */
  const hues = [
    { from: "#8B6CF6", to: "#6C4CF1" },
    { from: "#43E0C8", to: "#22D3B8" },
    { from: "#3EA7F5", to: "#2563EB" },
    { from: "#FBBF5C", to: "#E8A33D" },
    { from: "#FB7BA2", to: "#E1487C" },
    { from: "#6EE7A8", to: "#3FA96B" },
  ];
  const hue = hues[index % hues.length];

  if (!subject.isActive) {
    return (
      <div
        aria-disabled
        className="group relative isolate cursor-default select-none overflow-hidden rounded-2xl border border-border-light bg-surface-light p-4"
      >
        {/* The content underneath, blurred — the thing being withheld. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 p-4 opacity-[0.55] blur-[5px]">
          <div className="mt-9 flex flex-col gap-2">
            {[88, 72, 94, 64].map((w, i) => (
              <span
                key={i}
                className="block h-2.5 rounded-full"
                style={{
                  width: `${w}%`,
                  background: i === 1 ? `${hue.to}55` : "rgba(23,15,46,0.10)",
                }}
              />
            ))}
          </div>
        </div>

        {/* The sweep. Slow, and only one per card. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -inset-x-1/3 -z-10 motion-safe:animate-sheen"
          style={{ animationDelay: `${index * 420}ms` }}
        >
          <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-white/75 to-transparent blur-md" />
        </span>

        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-text-primary-light">{subject.name}</h2>

          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/35 bg-gold/12 px-2.5 py-1 text-[11px] font-semibold text-[#8A5A18]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#C9962F] motion-safe:animate-breathe" />
            </span>
            {labels.comingSoon}
          </span>
        </div>

        <p className="relative mt-[4.6rem] flex items-center gap-1.5 text-[12px] text-text-muted-light">
          <Lock size={12} />
          {labels.inPreparation}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/dashboard/qcm/${subject.slug}`}
      className="group relative isolate overflow-hidden rounded-2xl border border-border-light bg-surface-light p-4 transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_40px_-22px_rgba(108,76,241,0.65)]"
    >
      {/* A wash of the card's own colour, stronger on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-10 -top-14 -z-10 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `${hue.to}40`, opacity: 0.55 }}
      />

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-text-primary-light">{subject.name}</h2>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundImage: `linear-gradient(135deg, ${hue.from}, ${hue.to})` }}
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
        </span>
      </div>

      {/* Two chips, not one sentence: a line mixing Arabic words with
          Latin numerals gets reordered by the bidi algorithm and ends
          up reading wrong in both languages. */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11.5px] text-text-secondary-light">
          <span className="num font-bold tabular-nums text-text-primary-light">
            {subject.questionCount}
          </span>{" "}
          {labels.questions}
        </span>
        <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11.5px] text-text-secondary-light">
          <span className="num font-bold tabular-nums text-text-primary-light">
            {subject.topicCount}
          </span>{" "}
          {labels.topics}
        </span>
      </div>

      {/* A hint of the bank's size, as a bar that fills on hover. */}
      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <span
          className="block h-full w-1/4 rounded-full transition-[width] duration-500 group-hover:w-full"
          style={{ backgroundImage: `linear-gradient(90deg, ${hue.from}, ${hue.to})` }}
        />
      </span>
    </Link>
  );
}
