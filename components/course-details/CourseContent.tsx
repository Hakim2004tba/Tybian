import Link from "next/link";
import { Lock, PlayCircle, CheckCircle2, CircleDashed, Unlock, Layers, Hourglass } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import type { CourseSectionWithLessons, LessonWithVideoInfo, StudentAccessState } from "@/lib/data/course-details";
import { formatLessonLengthOrDash } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

type LessonState = "soon" | "free" | "locked" | "completed" | "in_progress" | "not_started";

function getLessonState(lesson: LessonWithVideoInfo, access: StudentAccessState): LessonState {
  /*
    NO VIDEO YET — checked before everything else.

    A lesson can exist on the syllabus before it is filmed, and saying
    so is better than either hiding it (the student cannot see what is
    coming) or showing it as a normal row that leads to an empty
    player. `video_id` is already nullable, so this needed no new
    column: the absence IS the state.
  */
  if (!lesson.hasVideo) return "soon";

  if (lesson.is_free_preview) return "free";
  if (!access.hasAccess) return "locked";

  const progress = access.progressByLessonId.get(lesson.id);
  if (progress?.isCompleted) return "completed";
  if (progress && progress.lastPositionSeconds > 0) return "in_progress";
  return "not_started";
}

const stateConfig: Record<
  LessonState,
  {
    icon: typeof Lock;
    iconClass: string;
    chipClass: string;
  }
> = {
  soon: { icon: Hourglass, iconClass: "text-gold", chipClass: "bg-gold/10" },
  free: { icon: Unlock, iconClass: "text-secondary", chipClass: "bg-secondary/10" },
  locked: { icon: Lock, iconClass: "text-text-muted-light", chipClass: "bg-bg-light" },
  completed: { icon: CheckCircle2, iconClass: "text-success", chipClass: "bg-success/10" },
  in_progress: { icon: PlayCircle, iconClass: "text-primary", chipClass: "bg-primary/10" },
  not_started: { icon: CircleDashed, iconClass: "text-text-muted-light", chipClass: "bg-bg-light" },
};

export async function CourseContent({
  courseSlug,
  sections,
  access,
}: {
  courseSlug: string;
  sections: CourseSectionWithLessons[];
  access: StudentAccessState;
}) {
  const { dict } = await getDictionary();
  const t = dict.courseDetails;
  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[17px]">
          <Layers size={17} className="text-primary" />
          {t.courseContent}
        </h3>
        <p className="mt-1 text-[13px] text-text-muted-light">
          {sections.length} {t.section} {sections.reduce((n, s) => n + s.lessons.length, 0)} {t.lesson}
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
                /* Nothing to open yet, whatever they have paid. */
                const clickable =
                  state !== "soon" && (state === "free" || (access.hasAccess && state !== "locked"));

                const content = (
                  <>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${config.chipClass}`}>
                      <Icon size={15} className={config.iconClass} strokeWidth={2} />
                    </span>
                    <span
                      className={
                        "min-w-0 flex-1 truncate text-[14px] " +
                        (state === "soon" ? "text-text-secondary-light" : "")
                      }
                    >
                      {lesson.title}
                    </span>

                    {/* The badge carries the news, and the only motion
                        on the row — a slow shimmer that reads as
                        "being prepared" rather than "loading". */}
                    {state === "soon" && (
                      <span className="relative shrink-0 overflow-hidden rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#8A5A18]">
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 -inset-x-6 motion-safe:animate-sheen"
                        >
                          <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-[2px]" />
                        </span>
                        <span className="relative">{t.comingSoon}</span>
                      </span>
                    )}

                    {state === "free" && (
                      <Badge variant="teal" className="shrink-0">
                        {t.free}
                      </Badge>
                    )}
                    {state !== "soon" && (
                      <span className="num shrink-0 text-[12.5px] text-text-muted-light">
                        {formatLessonLengthOrDash(lesson.durationSeconds)}
                      </span>
                    )}
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
                  <div
                    key={lesson.id}
                    className={
                      rowClass +
                      (state === "soon" ? " cursor-default" : " cursor-not-allowed opacity-60")
                    }
                  >
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
