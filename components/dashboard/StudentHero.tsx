import Link from "next/link";
import Image from "next/image";
import { BookOpen, CheckCircle2, Clock, Award, ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getAllProgress, computeStats, pickContinueLearning } from "@/lib/data/student-dashboard";
import { queryOne } from "@/lib/db";
import { formatHoursShort } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The dark anchor of the two-tone layout: one academy.deep panel at the
 * top of a lavender page, carrying the greeting and the four headline
 * numbers.
 *
 * Every number is computed from the student's real progress rows — the
 * same computeStats() the old StatsRow used, so this replaces that
 * section rather than duplicating its query. The certificates tile is
 * the honest exception: the platform has no certificates table yet, so
 * it shows completed courses (what a certificate would be issued for)
 * and is labelled as such, instead of inventing a count.
 */
export async function StudentHero({ name }: { name: string }) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const progress = await getAllProgress(user!.id);
  const stats = computeStats(progress);
  const inProgressCount = progress.filter(
    (p) => p.total_lessons > 0 && p.completed_lessons > 0 && p.completed_lessons < p.total_lessons
  ).length;
  // ProgressRow carries ids, not titles, so resolve the one course the
  // CTA names. Single row by primary key — the same lookup
  // ContinueLearningCard does, and only when there is something to resume.
  const resumeRow = pickContinueLearning(progress);
  let resume: { slug: string; title: string } | null = null;
  if (resumeRow) {
    const row = await queryOne<{ slug: string; title: string }>(
      `SELECT slug, title FROM courses WHERE id = ?`,
      [resumeRow.course_id]
    );
    if (row) resume = { slug: row.slug, title: row.title };
  }

  const dictHero = t.hero;
  const tiles = [
    { icon: BookOpen, value: String(inProgressCount), label: dictHero.inProgressCourses },
    { icon: CheckCircle2, value: String(stats.coursesCompleted), label: dictHero.completedCourses },
    { icon: Clock, value: formatHoursShort(stats.totalWatchSeconds), label: dictHero.studyHours },
    { icon: Award, value: String(stats.coursesCompleted), label: dictHero.certificateEligible },
  ];

  return (
    <section className="relative overflow-hidden rounded-xl bg-academy-deep">
      {/* Glow + grid texture: static CSS only, matching the hero rules
          in DESIGN_SYSTEM.md §8/§15 (one focal glow, no animation cost). */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(rgba(219,216,223,0.55) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-primary/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative grid items-center gap-5 p-5 md:gap-6 md:p-xl lg:grid-cols-[1.35fr_0.65fr]">
        {/* z-10: the phone's decorative figure below is absolutely
            positioned and later in the DOM, so without this it would
            paint over the greeting and the tiles. */}
        <div className="relative z-10">
          <p className="pe-[38%] text-[14px] text-white/60 md:pe-0">{t.hero.greeting} {name} 👋</p>
          <h1 className="mt-1 pe-[38%] text-[20px] font-bold leading-tight text-white md:mt-1.5 md:pe-0 md:text-[30px]">
            {t.hero.keepGoing} <span className="text-secondary">{t.hero.excellence}</span>
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/65 md:mt-2.5 md:text-[14px]">
            {t.hero.subtitle}
          </p>

          {resume ? (
            <Link href={`/courses/${resume.slug}/learn`} className="mt-4 inline-block md:mt-5">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,76,241,0.9)] transition-colors hover:bg-primary-hover md:px-5 md:py-2.5 md:text-[13.5px]">
                <span className="truncate">{t.common.continueLabel} {resume.title}</span>
                <ArrowLeft size={15} />
              </span>
            </Link>
          ) : (
            <Link href="/dashboard/explore" className="mt-4 inline-block md:mt-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,76,241,0.9)] transition-colors hover:bg-primary-hover">
                {t.hero.exploreCourses}
                <ArrowLeft size={15} />
              </span>
            </Link>
          )}

          {/*
            Four across on a phone, not two-by-two. Each tile is a
            glanceable number, not a paragraph — the labels are already
            two words — and one row keeps the card that follows above
            the fold, which is the point of the whole screen.
          */}
          <div className="mt-5 grid grid-cols-4 gap-2 md:mt-7 md:gap-3">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-2.5 backdrop-blur-sm md:px-3.5 md:py-3"
              >
                <t.icon size={16} className="text-secondary" strokeWidth={1.75} />
                <div className="num mt-1.5 text-[17px] font-bold leading-none text-white md:mt-2 md:text-[20px]">{t.value}</div>
                <div className="mt-1 text-[10.5px] leading-tight text-white/55 md:text-[11.5px]">{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/*
          On a phone the figure sits BEHIND the text rather than beside
          it: there is no room for two columns, and the design still
          wants it on screen. `pointer-events-none` and a low opacity
          keep it decorative — it must never intercept a tap meant for
          the continue button.
        */}
        <div
          className="pointer-events-none absolute end-0 top-0 flex h-[62%] w-[38%] items-start justify-end opacity-45 lg:hidden"
          aria-hidden="true"
        >
          <Image
            src="/hero/anatomy.webp"
            alt=""
            width={840}
            height={1260}
            className="h-[92%] w-auto object-contain"
            style={{
              maskImage: "linear-gradient(to bottom, #000 70%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 70%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative hidden justify-center lg:flex">
          <div
            className="pointer-events-none absolute top-1/2 h-[240px] w-[240px] -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.40) 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <Image
            src="/hero/anatomy.webp"
            alt=""
            width={840}
            height={1260}
            aria-hidden="true"
            className="relative w-full max-w-[190px] object-contain"
            style={{
              maskImage: "linear-gradient(to bottom, #000 74%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 74%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
