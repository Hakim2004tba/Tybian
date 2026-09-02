import Link from "next/link";
import { Lock, PlayCircle, CheckCircle2, CircleDashed, Unlock, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import type { CourseSectionWithLessons, LessonWithVideoInfo, StudentAccessState } from "@/lib/data/course-details";

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type LessonState = "free" | "locked" | "completed" | "in_progress" | "not_started";

function getLessonState(lesson: LessonWithVideoInfo, access: StudentAccessState): LessonState {
  if (lesson.is_free_preview) return "free";
  if (!access.hasAccess) return "locked";

  const progress = access.progressByLessonId.get(lesson.id);
  if (progress?.isCompleted) return "completed";
  if (progress && progress.lastPositionSeconds > 0) return "in_progress";
  return "not_started";
}

const stateConfig: Record<
  LessonState,
  { icon: typeof Lock; iconClass: string; chipClass: string; label: string }
> = {
  free: { icon: Unlock, iconClass: "text-secondary", chipClass: "bg-secondary/10", label: "معاينة مجانية" },
  locked: { icon: Lock, iconClass: "text-text-muted-light", chipClass: "bg-bg-light", label: "مقفل" },
  completed: { icon: CheckCircle2, iconClass: "text-success", chipClass: "bg-success/10", label: "مكتمل" },
  in_progress: { icon: PlayCircle, iconClass: "text-primary", chipClass: "bg-primary/10", label: "قيد التقدم" },
  not_started: { icon: CircleDashed, iconClass: "text-text-muted-light", chipClass: "bg-bg-light", label: "لم يبدأ" },
};

export function CourseContent({
  courseSlug,
  sections,
  access,
}: {
  courseSlug: string;
  sections: CourseSectionWithLessons[];
  access: StudentAccessState;
}) {
  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[17px]">
          <Layers size={17} className="text-primary" />
          محتوى الدورة
        </h3>
        <p className="mt-1 text-[13px] text-text-muted-light">
          {sections.length} قسم · {sections.reduce((n, s) => n + s.lessons.length, 0)} درس
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border-light">
        {sections.map((section, sectionIndex) => (
          <Reveal key={section.id} delay={sectionIndex * 60} className="p-lg">
            <h4 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
              <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary">
                {sectionIndex + 1}
              </span>
              {section.title}
            </h4>
            <div className="flex flex-col gap-1">
              {section.lessons.map((lesson) => {
                const state = getLessonState(lesson, access);
                const config = stateConfig[state];
                const Icon = config.icon;
                const clickable = state === "free" || (access.hasAccess && state !== "locked");

                const content = (
                  <>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${config.chipClass}`}>
                      <Icon size={15} className={config.iconClass} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{lesson.title}</span>
                    {state === "free" && (
                      <Badge variant="teal" className="shrink-0">
                        مجاني
                      </Badge>
                    )}
                    <span className="num shrink-0 text-[12.5px] text-text-muted-light">
                      {formatDuration(lesson.durationSeconds)}
                    </span>
                  </>
                );

                const rowClass =
                  "group flex items-center gap-3 rounded-md px-2.5 py-2 text-text-primary-light transition-all duration-200";

                return clickable ? (
                  <Link
                    key={lesson.id}
                    href={`/courses/${courseSlug}/learn?lesson=${lesson.id}`}
                    className={`${rowClass} hover:bg-primary/5`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={lesson.id} className={`${rowClass} cursor-not-allowed opacity-60`}>
                    {content}
                  </div>
                );
              })}
            </div>
          </Reveal>
        ))}
      </div>
    </Card>
  );
}
