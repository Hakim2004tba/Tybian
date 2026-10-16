import Link from "next/link";
import Image from "next/image";
import { Sprout, TreePine, Clock, Timer, Trophy } from "lucide-react";
import { PlotTree } from "@/components/dashboard/PlotTree";
import { gardenFromSeconds, treesFromSeconds, PLOT_SIZE } from "@/lib/study/garden";
import type { LeaderboardRow } from "@/lib/data/study-tools";
import { cn } from "@/lib/utils";

type Labels = Record<string, string>;

/** Minutes as "2h" / "45 min" — "120 min" is a correct answer to
 *  "when is the next tree" and a bad way to say two hours. */
function waitLabel(minutes: number, ar: boolean): string {
  if (minutes < 60) return `${minutes} ${ar ? "دقيقة" : "min"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (ar) return m ? `${h}س ${m}د` : `${h}س`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "4h 30m" / "4س 30د" — one formatter, so the two halves cannot drift. */
function hoursLabel(seconds: number, ar: boolean): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (ar) return h > 0 ? `${h}س ${m}د` : `${m}د`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * THE STUDY PLOT AND THE MONTH'S RANKING.
 *
 * Two halves that answer two different questions. The plot answers "am
 * I getting anywhere?" — always yes, because the next tree is a fixed
 * two hours away and no classmate can take it. The ranking answers
 * "how is the year doing?" — which is motivating only once the first
 * question has a good answer, and which is why it is the second half
 * and not the whole thing.
 *
 * Both are read from the same monthly minutes, so a student's trees and
 * their row in the table can never disagree.
 */
export function StudyPlot({
  rows,
  labels,
  locale,
}: {
  rows: LeaderboardRow[];
  labels: Labels;
  locale: string;
}) {
  const ar = locale === "ar";
  const me = rows.find((r) => r.isCurrentUser);
  const garden = gardenFromSeconds(me?.monthlySeconds ?? 0);

  return (
    <section className="flex flex-col gap-4">
      {/* ---- the banner ---- */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-border-light bg-gradient-to-br from-primary/[0.09] via-surface-light to-secondary/[0.07] p-5 md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -end-16 -z-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-[19px] font-bold text-text-primary-light md:text-[21px]">
              <Sprout size={20} className="text-primary" />
              {labels.title}
            </h2>
            <p className="mt-1 text-[13.5px] text-text-secondary-light">{labels.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Stat
              icon={<Clock size={15} />}
              value={hoursLabel(me?.monthlySeconds ?? 0, ar)}
              label={labels.hoursThisMonth}
            />
            <Stat
              icon={<TreePine size={15} />}
              value={String(garden.lit)}
              label={labels.litTrees}
              accent
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ---- the plot ---- */}
        <div className="rounded-2xl border border-border-light bg-surface-light p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-text-primary-light">{labels.myGarden}</h3>
            {garden.expansions > 0 && (
              <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11.5px] font-semibold text-[#8A5A18]">
                {labels.expanded} <span className="num">{garden.expansions}</span>
              </span>
            )}
          </div>

          {/* The ground. A soft field rather than a grid of boxes — the
              trees are the content, the plot is just where they stand. */}
          <div className="mt-4 rounded-xl bg-gradient-to-b from-[#EEF6EC] to-[#E3F0E4] p-3.5 md:p-4">
            <div className="grid grid-cols-5 gap-x-1.5 gap-y-3 sm:grid-cols-5 md:gap-x-2.5">
              {Array.from({ length: garden.capacity }, (_, i) => (
                <PlotTree key={i} index={i + 1} lit={i < garden.lit} />
              ))}
            </div>
          </div>

          {/* Progress toward the next tree — the only place a fraction
              belongs, since a tree itself is all or nothing. */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-text-secondary-light">
                {labels.nextTreeIn}{" "}
                <span className="num font-semibold text-text-primary-light">
                  {waitLabel(garden.minutesToNextTree, ar)}
                </span>
              </span>
              <span className="num text-text-muted-light">
                {garden.lit} / {garden.capacity}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700"
                style={{ width: `${Math.round(garden.fractionToNextTree * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted-light">
              {garden.remaining === 0 ? labels.plotFull : labels.monthlyNote}
            </p>
          </div>
        </div>

        {/* ---- the ranking ---- */}
        <div className="rounded-2xl border border-border-light bg-surface-light p-4 md:p-5">
          <div className="flex items-center gap-2">
            <Trophy size={17} className="text-gold" />
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary-light">{labels.ranking}</h3>
              <p className="text-[12px] text-text-muted-light">{labels.rankingNote}</p>
            </div>
          </div>

          <ol className="mt-4 flex flex-col gap-1.5">
            {rows.map((row, i) => (
              <RankRow
                key={row.userId}
                row={row}
                place={i + 1}
                ar={ar}
                youLabel={labels.you}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon, value, label, accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5 rounded-xl border border-border-light bg-surface-light px-3.5 py-2.5">
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          accent ? "bg-gold/15 text-[#8A5A18]" : "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="num text-[15px] font-bold text-text-primary-light">{value}</span>
        <span className="text-[11.5px] text-text-muted-light">{label}</span>
      </span>
    </span>
  );
}

/* Gold, silver, bronze — and nothing for the rest, so the medal keeps
   meaning something. */
const MEDALS = ["bg-[#E8A33D]", "bg-[#A8AEC0]", "bg-[#C77B4A]"];

function RankRow({
  row, place, ar, youLabel,
}: {
  row: LeaderboardRow;
  place: number;
  ar: boolean;
  youLabel: string;
}) {
  const medal = place <= 3 ? MEDALS[place - 1] : null;
  const trees = treesFromSeconds(row.monthlySeconds);

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-2.5 py-2 transition",
        /* The student's own row is the one they look for first; it is
           marked by a ring rather than a fill, so it stays readable
           when it also happens to be in the top three. */
        row.isCurrentUser
          ? "bg-primary/[0.07] ring-1 ring-primary/30"
          : place <= 3
            ? "bg-black/[0.02]"
            : ""
      )}
    >
      <span
        className={cn(
          "num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
          medal ? `${medal} text-white` : "bg-black/[0.05] text-text-secondary-light"
        )}
      >
        {place}
      </span>

      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/10">
        {row.avatarUrl ? (
          <Image src={row.avatarUrl} alt="" fill sizes="32px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[12px] font-bold text-primary">
            {row.fullName.trim().charAt(0)}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-text-primary-light">
          {row.fullName}
          {row.isCurrentUser && (
            <span className="ms-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
              {youLabel}
            </span>
          )}
        </span>
      </span>

      <span className="num shrink-0 text-[12.5px] font-semibold text-text-primary-light">
        {hoursLabel(row.monthlySeconds, ar)}
      </span>

      <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-text-secondary-light">
        <TreePine size={13} className="text-[#3FA96B]" />
        <span className="num">{trees}</span>
      </span>
    </li>
  );
}

/** Nothing planted yet — the ground, and the one button that starts it. */
export function EmptyPlot({ labels }: { labels: Labels }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border-light bg-gradient-to-br from-primary/[0.09] via-surface-light to-secondary/[0.07] p-6 md:p-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -end-16 -z-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
      />
      <h2 className="flex items-center gap-2 text-[19px] font-bold text-text-primary-light">
        <Sprout size={20} className="text-primary" />
        {labels.title}
      </h2>
      <p className="mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-text-secondary-light">
        {labels.emptyBody}
      </p>

      {/* The empty ground itself: seeing the twenty spaces they are
          about to fill is the whole point of showing it. */}
      <div className="mt-5 max-w-lg rounded-xl bg-gradient-to-b from-[#EEF6EC] to-[#E3F0E4] p-4">
        <div className="grid grid-cols-5 gap-x-2.5 gap-y-3">
          {Array.from({ length: PLOT_SIZE }, (_, i) => (
            <PlotTree key={i} index={i + 1} lit={false} />
          ))}
        </div>
      </div>

      <Link
        href="/dashboard/study"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-primary/90"
      >
        <Timer size={16} />
        {labels.startTimer}
      </Link>
    </section>
  );
}
