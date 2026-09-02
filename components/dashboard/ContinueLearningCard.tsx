import Image from "next/image";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAllProgress, pickContinueLearning } from "@/lib/data/student-dashboard";

/**
 * Its own Suspense boundary. Reuses getAllProgress's request-level
 * cache (see StatsRow) so this never re-issues the RPC call that
 * StatsRow already made.
 */
export async function ContinueLearningCard() {
  const user = await getSessionUser();
  const progress = await getAllProgress(user!.id);
  const target = pickContinueLearning(progress);

  if (!target) return null;

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("slug, title, cover_url, teachers ( profiles ( full_name ) )")
    .eq("id", target.course_id)
    .maybeSingle();

  if (!course) return null;

  const teacherRaw = Array.isArray(course.teachers) ? course.teachers[0] : course.teachers;
  const profileRaw = teacherRaw
    ? (Array.isArray(teacherRaw.profiles) ? teacherRaw.profiles[0] : teacherRaw.profiles)
    : null;
  const teacherName = profileRaw?.full_name ?? null;

  const pct = target.total_lessons > 0 ? Math.round((target.completed_lessons / target.total_lessons) * 100) : 0;
  const lastLessonLabel =
    target.last_section_title && target.last_lesson_title
      ? `${target.last_section_title} — ${target.last_lesson_title}`
      : null;

  return (
    <Card tone="dark" padded={false} className="relative overflow-hidden">
      <div className="glow-violet" style={{ opacity: 0.5 }} />
      <div className="relative grid gap-0 md:grid-cols-[1fr_1.3fr]">
        <div className="relative aspect-video md:aspect-auto">
          {course.cover_url && (
            <Image src={course.cover_url} alt={course.title} fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="p-lg">
          <Badge variant="teal">تابع من حيث توقفت</Badge>
          <h3 className="mt-3 text-[18px] text-text-primary-dark">{course.title}</h3>
          {teacherName && <p className="mt-1 text-[13px] text-text-muted-dark">{teacherName}</p>}

          <div className="mt-5">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="num font-semibold text-primary">{pct}% completed</span>
              <span className="num text-text-muted-dark">
                {target.completed_lessons}/{target.total_lessons}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border-dark">
              <div
                className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {lastLessonLabel && (
            <p className="mt-3 text-[12.5px] text-text-muted-dark">
              <span className="text-text-secondary-dark">متابعة:</span> {lastLessonLabel}
            </p>
          )}

          <Link
            href={
              target.last_lesson_id
                ? `/courses/${course.slug}/learn?lesson=${target.last_lesson_id}`
                : `/courses/${course.slug}`
            }
            className="mt-5 block w-fit"
          >
            <Button>
              <PlayCircle size={16} />
              متابعة التعلم
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
