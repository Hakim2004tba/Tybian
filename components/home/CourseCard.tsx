"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Users, Clock, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { FeaturedCourse } from "@/lib/data/homepage";
import { formatCourseMinutes } from "@/lib/format/duration";
import { useI18n } from "@/lib/i18n/I18nProvider";

const priceFormatter = new Intl.NumberFormat("en-US");

export function CourseCard({ course }: { course: FeaturedCourse }) {
  const { t } = useI18n();

  const {
    slug,
    title,
    teacherName,
    coverUrl,
    yearName,
    rating,
    ratingCount,
    studentsCount,
    durationHours,
    lessonsCount,
    minPrice,
    isNew,
  } = course;

  return (
    <Card tone="dark" padded={false} interactive className="flex flex-col overflow-hidden">
      {/* Shorter than 16:9 on a phone. Six full-width cards at video
          aspect made the featured section four screens tall on its own;
          the cover is decoration here, the title and price are the
          content. */}
      <div className="group relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-[#160f2c] to-[#241a42] sm:aspect-video">
        {coverUrl && (
          <Image
            src={coverUrl}
            alt={title}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            unoptimized
          />
        )}
        {isNew && (
          <Badge variant="teal" className="absolute right-3 top-3">
            {t.course.new}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 md:p-lg">
        <Badge variant="violet" className="w-fit">
          {yearName}
        </Badge>

        <h3 className="mt-2 text-[15.5px] leading-snug md:mt-2.5 md:text-[17px]">{title}</h3>

        <div className="mt-2.5 flex items-center gap-2 md:mt-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#9c7cf5] text-[11px] font-semibold text-white">
            {teacherName.split(" ").slice(-1)[0]?.[0] ?? t.course.teacherInitial}
          </div>
          <span className="text-[13.5px] text-text-secondary-dark">{teacherName}</span>
        </div>

        <div className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted-dark md:mt-4 md:gap-x-4 md:gap-y-1.5 md:text-[12.5px]">
          <span className="flex items-center gap-1">
            <Star size={13} className="fill-gold text-gold" />
            {ratingCount > 0 ? (
              <>
                {rating.toFixed(1)} <span className="text-text-muted-dark">({ratingCount})</span>
              </>
            ) : (
              <span className="text-text-muted-dark">{t.course.newFem}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} />
            {priceFormatter.format(studentsCount)}
          </span>
          {durationHours > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {formatCourseMinutes(durationHours * 60)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <PlayCircle size={13} />
            {lessonsCount} {t.course.lessons}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border-dark pt-4">
          <div className="num flex items-baseline gap-2">
            {minPrice !== null ? (
              <span className="text-lg font-bold text-text-primary-dark">
                {priceFormatter.format(minPrice)} {t.course.currency}
              </span>
            ) : (
              <span className="text-[13px] text-text-muted-dark">{t.course.priceSoon}</span>
            )}
          </div>
          <Link href={`/courses/${slug}`}>
            <Button size="sm">{t.course.viewCourse}</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
