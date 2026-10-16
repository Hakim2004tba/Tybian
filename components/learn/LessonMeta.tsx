import { Clock, BookOpen } from "lucide-react";
import { MarkCompleteButton } from "@/components/learn/MarkCompleteButton";
import { formatLessonLength } from "@/lib/format/duration";

export function LessonMeta({
  title,
  courseTitle,
  durationSeconds,
  lessonId,
  courseSlug,
  isCompleted,
  hasAccess,
}: {
  title: string;
  courseTitle: string;
  durationSeconds: number;
  lessonId: string;
  courseSlug: string;
  isCompleted: boolean;
  hasAccess: boolean;
}) {
  const duration = formatLessonLength(durationSeconds) || null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] text-text-primary-dark">{title}</h1>
        <div className="num mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-muted-dark">
          {duration && (
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {duration}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <BookOpen size={13} />
            {courseTitle}
          </span>
        </div>
      </div>

      {hasAccess && <MarkCompleteButton lessonId={lessonId} courseSlug={courseSlug} isCompleted={isCompleted} />}
    </div>
  );
}
