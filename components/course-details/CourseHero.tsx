import Image from "next/image";
import { Star, Users, PlayCircle, Clock, ListVideo, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import type { CourseDetails } from "@/lib/data/course-details";
import { formatCourseMinutes } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Stat "chips" — an icon in a small colored circle, matching the
 * language used elsewhere on the site (dashboard stat cards, admin
 * analytics) rather than bare inline icon+text, which read visually
 * flat/unfinished at this prominence.
 */
function StatChip({ icon: Icon, children }: { icon: typeof Star; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-sm">
      <Icon size={14} className="shrink-0 text-primary" />
      <span className="num text-[13px] text-text-secondary-dark">{children}</span>
    </div>
  );
}

export async function CourseHero({ course }: { course: CourseDetails }) {
  const { dict } = await getDictionary();
  const t = dict.courseDetails;
  const teacherName = course.teachers?.profiles?.full_name;

  return (
    <section className="relative overflow-hidden bg-bg-dark">
      <div className="glow-violet animate-pulse-slow" style={{ opacity: 0.6 }} />
      <div className="relative mx-auto grid max-w-content gap-10 px-md py-3xl md:px-xl lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="violet">{course.academic_years?.name_ar ?? "—"}</Badge>
            {course.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="teal">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="relative mt-4 inline-block text-[28px] leading-[1.25] text-text-primary-dark md:text-[36px]">
            {course.title}
            <span className="absolute -bottom-2 right-0 h-[3px] w-14 rounded-full bg-gradient-to-l from-primary to-transparent" />
          </h1>

          {course.short_description && (
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-text-secondary-dark">
              {course.short_description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <StatChip icon={Star}>
              {course.rating.toFixed(1)} <span className="text-text-muted-dark">({course.rating_count})</span>
            </StatChip>
            <StatChip icon={Users}>{course.students_count} {t.student}</StatChip>
            <StatChip icon={ListVideo}>{course.lessons_count} {t.lesson}</StatChip>
            <StatChip icon={PlayCircle}>{course.videos_count} {t.video}</StatChip>
            <StatChip icon={Clock}>
              {formatCourseMinutes(course.duration_minutes)}
            </StatChip>
          </div>

          <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#9c7cf5] text-white shadow-[0_0_0_3px_rgba(108,76,241,0.15)]">
              {teacherName ? (
                <span className="text-[14px] font-semibold">{teacherName[0]}</span>
              ) : (
                <GraduationCap size={17} />
              )}
            </div>
            <div>
              <div className="text-[14.5px] font-semibold text-text-primary-dark">
                {teacherName ?? t.teacherUnset}
              </div>
              {course.teachers?.title && (
                <div className="text-[12.5px] text-text-muted-dark">{course.teachers.title}</div>
              )}
            </div>
          </div>
        </Reveal>

        {course.cover_url && (
          <Reveal delay={140} variant="scale">
            <div className="group relative aspect-video overflow-hidden rounded-xl border border-border-dark shadow-[0_20px_60px_-15px_rgba(108,76,241,0.35)]">
              <Image
                src={course.cover_url}
                alt={course.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
