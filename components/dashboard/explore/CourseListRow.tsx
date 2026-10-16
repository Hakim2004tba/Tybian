import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, BookOpen } from "lucide-react";
import type { CourseSearchResult } from "@/lib/data/course-search";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * One course as a compact row: cover, title, subtitle, progress.
 *
 * The phone layout the team designed puts courses in a list rather than
 * the desktop grid of tall cards — a grid of two columns on a 375px
 * screen leaves each cover about 160px wide and the title clipped, and
 * a student scanning "which one am I in the middle of" reads a column
 * of rows far faster than a mosaic.
 *
 * `percent` is null for a course the student has not started; the row
 * then shows the lesson count instead of a 0% bar, because an empty
 * progress bar on every unopened course reads as failure rather than as
 * "not begun".
 */
export async function CourseListRow({
  course,
  percent,
}: {
  course: CourseSearchResult;
  percent: number | null;
}) {
  const { dict } = await getDictionary();
  const subtitle =
    course.teachers?.profiles?.full_name ?? course.academic_years?.name_ar ?? null;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white p-2.5 transition-colors hover:border-primary/40"
    >
      <span className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-academy-lavender">
        {course.cover_url ? (
          <Image
            src={course.cover_url}
            alt=""
            fill
            sizes="58px"
            className="object-cover"
          />
        ) : (
          <BookOpen size={20} className="text-primary/50" strokeWidth={1.5} />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-text-primary-light">
          {course.title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[11.5px] text-text-muted-light">
            {subtitle}
          </span>
        )}

        {percent === null ? (
          <span className="num mt-1.5 block text-[11px] text-text-muted-light">
            {course.lessons_count} {dict.search.lessons}
          </span>
        ) : (
          <>
            <span className="num mt-1.5 block text-[11px] text-primary">
              {percent}% {dict.dash.common.completed}
            </span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-academy-lavender">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </span>
          </>
        )}
      </span>

      {/*
        A chevron that points the way the page reads: `rtl:rotate-180`
        would be wrong here — ChevronLeft already points at the reading
        end in Arabic, and flipping it would aim it back at the margin.
      */}
      <ChevronLeft size={17} className="shrink-0 text-text-muted-light rtl:rotate-0 ltr:-scale-x-100" />
    </Link>
  );
}
