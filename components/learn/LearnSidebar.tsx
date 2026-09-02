import Link from "next/link";
import type { LearnSection } from "@/lib/data/learn";
import { CourseContentTree } from "@/components/learn/CourseContentTree";

/**
 * Desktop only (hidden lg:flex) — sticky, self-contained (only the
 * course content, not the whole viewport height as an empty column).
 * The mobile equivalent is MobileCourseDrawer, sharing the same
 * CourseContentTree so the lesson-list logic isn't duplicated.
 */
export function LearnSidebar({
  courseTitle,
  courseSlug,
  sections,
  currentLessonId,
  hasAccess,
  completedLessonIds,
}: {
  courseTitle: string;
  courseSlug: string;
  sections: LearnSection[];
  currentLessonId: string;
  hasAccess: boolean;
  completedLessonIds: Set<string>;
}) {
  return (
    <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-[340px] shrink-0 flex-col border-s border-border-dark bg-bg-dark text-text-secondary-dark lg:flex">
      <div className="border-b border-border-dark p-lg pb-4">
        <Link href={`/courses/${courseSlug}`} className="text-[13px] text-text-muted-dark hover:text-primary">
          العودة إلى صفحة الدورة
        </Link>
        <h2 className="mt-1.5 text-[17px] text-text-primary-dark">{courseTitle}</h2>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <CourseContentTree
          courseSlug={courseSlug}
          sections={sections}
          currentLessonId={currentLessonId}
          hasAccess={hasAccess}
          completedLessonIds={completedLessonIds}
        />
      </div>
    </aside>
  );
}
