"use client";

import Link from "next/link";
import { Check, Play, Lock, Circle } from "lucide-react";
import type { LearnSection } from "@/lib/data/learn";
import { CollapsibleModule } from "@/components/learn/CollapsibleModule";
import { cn } from "@/lib/utils";
import { formatLessonLength } from "@/lib/format/duration";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * The course-progress bar + collapsible modules — shared between the
 * desktop sticky sidebar (LearnSidebar) and the mobile drawer
 * (MobileCourseDrawer), so the lesson-list rendering logic exists in
 * exactly one place rather than being duplicated per breakpoint.
 */
export function CourseContentTree({
  courseSlug,
  sections,
  currentLessonId,
  hasAccess,
  completedLessonIds,
  onNavigate,
}: {
  courseSlug: string;
  sections: LearnSection[];
  currentLessonId: string;
  hasAccess: boolean;
  completedLessonIds: Set<string>;
  /** Called when a lesson link is clicked — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}) {
  const { t: T } = useI18n();
  const t = T.learn;
  const totalLessons = sections.reduce((n, s) => n + s.lessons.length, 0);
  const completedCount = sections.reduce(
    (n, s) => n + s.lessons.filter((l) => completedLessonIds.has(l.id)).length,
    0
  );
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <>
      <div className="border-b border-border-dark p-lg">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-text-secondary-dark">{t.courseProgress}</span>
          <span className="num font-semibold text-primary">{progressPct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border-dark">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="num mt-1.5 text-[11.5px] text-text-muted-dark">
          {completedCount} {t.of} {totalLessons} {t.lessonsCompleted}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => {
          const sectionCompleted = section.lessons.filter((l) => completedLessonIds.has(l.id)).length;
          const containsCurrent = section.lessons.some((l) => l.id === currentLessonId);

          return (
            <CollapsibleModule
              key={section.id}
              title={section.title}
              countLabel={`(${sectionCompleted}/${section.lessons.length})`}
              defaultOpen={containsCurrent || sectionCompleted < section.lessons.length}
            >
              {section.lessons.map((lesson) => {
                const isCurrent = lesson.id === currentLessonId;
                const isCompleted = completedLessonIds.has(lesson.id);
                const isLocked = !lesson.isFreePreview && !hasAccess;

                const Icon = isCurrent ? Play : isCompleted ? Check : isLocked ? Lock : Circle;
                const iconClass = isCurrent
                  ? "text-white"
                  : isCompleted
                    ? "text-success"
                    : isLocked
                      ? "text-text-muted-dark"
                      : "text-text-muted-dark/50";
                const iconBg = isCurrent ? "bg-primary" : isCompleted ? "bg-success/15" : "bg-white/[0.04]";

                const rowClass = cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-[13.5px] transition-colors",
                  isCurrent && "bg-primary/[0.14] text-text-primary-dark",
                  !isCurrent && !isLocked && "hover:bg-primary/[0.08] hover:text-text-primary-dark",
                  isLocked && "opacity-60"
                );

                const content = (
                  <>
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", iconBg)}>
                      <Icon size={isCurrent ? 11 : 13} className={iconClass} strokeWidth={2.2} fill={isCurrent ? "currentColor" : "none"} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                    {lesson.durationSeconds > 0 && (
                      <span className="num shrink-0 text-[11px] text-text-muted-dark">
                        {formatLessonLength(lesson.durationSeconds)}
                      </span>
                    )}
                  </>
                );

                return isLocked ? (
                  <Link key={lesson.id} href={`/courses/${courseSlug}`} className={rowClass} title={t.subscribeToUnlock} onClick={onNavigate}>
                    {content}
                  </Link>
                ) : (
                  <Link
                    key={lesson.id}
                    href={`/courses/${courseSlug}/learn?lesson=${lesson.id}`}
                    className={rowClass}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={onNavigate}
                  >
                    {content}
                  </Link>
                );
              })}
            </CollapsibleModule>
          );
        })}
      </div>
    </>
  );
}
