import Image from "next/image";
import Link from "next/link";
import { Star, Users, Clock, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CourseSearchResult } from "@/lib/data/course-search";

const currency = new Intl.NumberFormat("en-US");
const levelLabel: Record<string, string> = { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" };

export function CourseSearchCard({ course }: { course: CourseSearchResult }) {
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
            <Badge variant="muted">{levelLabel[course.level] ?? course.level}</Badge>
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
              <Clock size={12} />
              {Math.floor(course.duration_minutes / 60)}س
            </span>
          </div>

          <div className="mt-auto pt-4">
            {course.min_price !== null ? (
              <span className="num text-[16px] font-bold">{currency.format(course.min_price)} دج</span>
            ) : (
              <span className="text-[13px] text-text-muted-light">السعر غير متاح</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
