import Image from "next/image";
import Link from "next/link";
import { PlayCircle, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ProgressRow, EnrolledCourseSummary } from "@/lib/data/student-dashboard";
import { getDictionary } from "@/lib/i18n/locale";

export async function DashboardCourseCard({
  course,
  progress,
}: {
  course: EnrolledCourseSummary;
  progress: ProgressRow | undefined;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const total = progress?.total_lessons ?? 0;
  const completed = progress?.completed_lessons ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const continueHref =
    progress?.last_lesson_id ? `/courses/${course.slug}/learn?lesson=${progress.last_lesson_id}` : `/courses/${course.slug}`;

  const lastLessonLabel =
    progress?.last_section_title && progress?.last_lesson_title
      ? `${progress.last_section_title} — ${progress.last_lesson_title}`
      : t.common.notStarted;

  return (
    <Card padded={false} interactive className="flex min-w-0 flex-col overflow-hidden">
      <div className="relative aspect-video bg-gradient-to-br from-[#160f2c] to-[#241a42]">
        {course.cover_url ? (
          <Image src={course.cover_url} alt={course.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-text-muted-dark">
            <BookOpen size={28} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-lg">
        <h3 className="break-words text-[15.5px] leading-snug">{course.title}</h3>
        {course.teacherName && (
          <p className="mt-1 text-[13px] text-text-muted-light">{course.teacherName}</p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="num font-semibold text-primary">{pct}% {t.common.completed}</span>
            <span className="num text-text-muted-light">
              {completed}/{total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border-light">
            <div
              className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="mt-3 truncate text-[12.5px] text-text-muted-light">
          <span className="text-text-secondary-light">{t.common.resuming}</span> {lastLessonLabel}
        </p>

        <Link href={continueHref} className="mt-4">
          <Button size="sm" className="w-full justify-center">
            <PlayCircle size={14} />
            {t.common.continueLearning}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
