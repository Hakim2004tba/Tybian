import Link from "next/link";
import { ChevronRight, ChevronLeft, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AdjacentLessons } from "@/lib/video/adjacent-lessons";

export function PrevNextNav({
  courseSlug,
  adjacent,
  completedCount,
  totalCount,
}: {
  courseSlug: string;
  adjacent: AdjacentLessons;
  completedCount: number;
  totalCount: number;
}) {
  const { previous, next, nextLocked } = adjacent;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr]">
      {previous ? (
        <Link href={`/courses/${courseSlug}/learn?lesson=${previous.id}`}>
          <Card tone="dark" interactive className="flex h-full min-w-0 items-center gap-2.5">
            <ChevronRight size={16} className="shrink-0 text-text-muted-dark" />
            <span className="min-w-0">
              <span className="block text-[11px] text-text-muted-dark">الدرس السابق</span>
              <span className="block truncate text-[13.5px] font-medium text-text-primary-dark">{previous.title}</span>
            </span>
          </Card>
        </Link>
      ) : (
        <span />
      )}

      <Card tone="dark" className="flex flex-col justify-center">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-text-muted-dark">تقدّم الدورة</span>
          <span className="num font-semibold text-primary">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-dark">
          <div className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover" style={{ width: `${pct}%` }} />
        </div>
        <div className="num mt-1.5 text-center text-[11.5px] text-text-muted-dark">
          {completedCount} من {totalCount} دروس مكتملة
        </div>
      </Card>

      {next ? (
        nextLocked ? (
          <Card tone="dark" className="flex h-full min-w-0 items-center justify-end gap-2.5 border-dashed opacity-70" title="اشترك في الدورة لمتابعة هذا الدرس">
            <span className="min-w-0 text-end">
              <span className="block text-[11px] text-text-muted-dark">الدرس التالي (مقفل)</span>
              <span className="block truncate text-[13.5px] font-medium text-text-primary-dark">{next.title}</span>
            </span>
            <Lock size={16} className="shrink-0 text-text-muted-dark" />
          </Card>
        ) : (
          <Link href={`/courses/${courseSlug}/learn?lesson=${next.id}`}>
            <Card tone="dark" interactive className="flex h-full min-w-0 items-center justify-end gap-2.5">
              <span className="min-w-0 text-end">
                <span className="block text-[11px] text-text-muted-dark">الدرس التالي</span>
                <span className="block truncate text-[13.5px] font-medium text-text-primary-dark">{next.title}</span>
              </span>
              <ChevronLeft size={16} className="shrink-0 text-text-muted-dark" />
            </Card>
          </Link>
        )
      ) : (
        <span />
      )}
    </div>
  );
}
