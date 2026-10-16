import Link from "next/link";
import Image from "next/image";
import { PlayCircle, Clock, Layers } from "lucide-react";
import type { LinkedCourse } from "@/lib/data/library";

/**
 * "Watch the course that explains this lesson."
 *
 * A student reading a PDF of a lecture and wanting the video had to
 * leave, open the catalogue and find the course by name. This is the
 * bridge: one card, under the document, that goes straight there.
 *
 * Deliberately a single wide banner rather than a course tile — it is
 * not an item in a catalogue to be compared with others, it is one
 * onward door from the thing already being read.
 */
export function CourseLinkCard({
  course,
  labels,
}: {
  course: LinkedCourse;
  labels: { watch: string; related: string; lessons: string; minutes: string };
}) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      /*
        It has to be noticed without shouting. The entrance plays once
        when the lesson opens — a card that slides in is seen, a card
        that is simply there is scrolled past — and the standing glow
        is a slow pulse behind the border rather than anything moving,
        so it does not compete with the document for attention while
        the student reads.
      */
      className="group relative isolate mt-5 flex items-stretch gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-surface-light to-secondary/[0.07] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_14px_36px_-16px_rgba(108,76,241,0.6)] motion-safe:animate-[cardIn_560ms_cubic-bezier(0.22,1,0.36,1)] sm:gap-4 sm:p-4"
    >
      {/* The slow light behind it. Decoration, and never over the text. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-10 -top-16 -z-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl motion-safe:animate-pulse-slow"
      />
      {/* The cover carries the recognition — a student knows their
          course by its picture long before they read its title. */}
      <div className="relative h-[62px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-academy-lavender sm:h-[84px] sm:w-[140px]">
        {course.coverUrl ? (
          <Image
            src={course.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 84px, 140px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
          <PlayCircle size={30} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-primary">
          {labels.related}
        </span>
        <span className="mt-0.5 truncate text-[15px] font-semibold text-text-primary-light">
          {course.title}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-secondary-light">
          {course.teacherName && <span className="truncate">{course.teacherName}</span>}
          {course.lessonsCount > 0 && (
            <span className="flex items-center gap-1">
              <Layers size={13} />
              <span className="num">{course.lessonsCount}</span> {labels.lessons}
            </span>
          )}
          {course.durationMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={13} />
              <span className="num">{course.durationMinutes}</span> {labels.minutes}
            </span>
          )}
        </span>
      </div>

      <span className="flex shrink-0 items-center">
        <span className="relative flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition group-hover:bg-primary/90">
          {/* A ring that breathes outward from the button — the one
              moving thing on the card, and only while the pointer is
              away from it. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/40 motion-safe:animate-ping group-hover:hidden"
          />
          <PlayCircle size={17} />
          <span className="hidden sm:inline">{labels.watch}</span>
        </span>
      </span>
    </Link>
  );
}
