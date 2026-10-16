import Image from "next/image";
import Link from "next/link";
import { Star, Users, Clock, PlayCircle, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CourseSearchResult } from "@/lib/data/course-search";
import { formatCourseMinutes } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

const currency = new Intl.NumberFormat("en-US");
export async function CourseSearchCard({ course }: { course: CourseSearchResult }) {
  const { dict } = await getDictionary();
  const t = dict.search;
  const teacherName = course.teachers?.profiles?.full_name ?? null;

  return (
    <Link href={`/courses/${course.slug}`}>
      <Card padded={false} interactive className="flex h-full flex-col overflow-hidden">
        <div className="relative aspect-video bg-gradient-to-br from-[#160f2c] to-[#241a42]">
          {course.cover_url ? (
            <Image src={course.cover_url} alt={course.title} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-text-muted-dark">
              <BookOpen size={26} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-lg">
          <div className="flex flex-wrap gap-1.5">
            {course.academic_years && <Badge variant="violet">{course.academic_years.name_ar}</Badge>}
          </div>

          <h3 className="mt-2.5 text-[15px] leading-snug">{course.title}</h3>
          {teacherName && <p className="mt-1 text-[13px] text-text-muted-light">{teacherName}</p>}

          <div className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted-light">
            <span className="flex items-center gap-1">
              <Star size={12} className="fill-gold text-gold" />
              {course.rating.toFixed(1)} ({course.rating_count})
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {course.students_count}
            </span>
            <span className="flex items-center gap-1">
              <PlayCircle size={12} />
              {course.lessons_count} {t.lessons}
            </span>
            {/* Duration is only shown once it is actually known. The card
                used to print "0س" for every course, because YouTube's
                oEmbed does not report duration and nothing had filled it
                in — a stated zero is worse than an honest dash. */}
            {course.duration_minutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatCourseMinutes(course.duration_minutes)}
              </span>
            )}
          </div>

          <div className="mt-auto pt-4">
            {course.min_price !== null ? (
              <span className="num text-[16px] font-bold">{currency.format(course.min_price)} {t.currency}</span>
            ) : (
              <span className="text-[13px] text-text-muted-light">{t.priceUnavailable}</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
