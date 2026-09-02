"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { List, X } from "lucide-react";
import type { LearnSection } from "@/lib/data/learn";
import type { Locale } from "@/lib/i18n/dictionaries";
import { CourseContentTree } from "@/components/learn/CourseContentTree";
import { cn } from "@/lib/utils";

/**
 * Mobile-only (lg:hidden) — a "☰ محتوى الدورة" trigger that opens the
 * same CourseContentTree used by the desktop sidebar as a slide-in
 * drawer, mirroring the site's existing MobileNav pattern (same
 * backdrop/transition mechanics) rather than permanently stacking the
 * full lesson list below the video on small screens.
 */
export function MobileCourseDrawer({
  courseTitle,
  courseSlug,
  sections,
  currentLessonId,
  hasAccess,
  completedLessonIds,
  locale,
}: {
  courseTitle: string;
  courseSlug: string;
  sections: LearnSection[];
  currentLessonId: string;
  hasAccess: boolean;
  completedLessonIds: Set<string>;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  // `document` doesn't exist during SSR — only portal once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border-dark bg-elevated-dark px-3.5 py-2 text-[13px] text-text-secondary-dark"
      >
        <List size={15} />
        محتوى الدورة
      </button>

      {mounted &&
        createPortal(
          <>
            {/* Rendered via createPortal directly into document.body —
                see MobileNav.tsx for the full explanation: a
                `filter`/`backdrop-filter` on ANY ancestor becomes the
                containing block for `position: fixed` descendants,
                which can silently collapse a "full height" fixed
                drawer down to that ancestor's own height. This
                component isn't currently nested under a blurred
                ancestor, but portaling costs nothing and makes it
                robust to that regardless of future changes upstream. */}
            <div
              className={cn(
                "fixed inset-0 z-50 bg-black/60 transition-opacity duration-200",
                open ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              className={cn(
                "fixed inset-y-0 z-50 flex w-[86%] max-w-[360px] flex-col bg-bg-dark text-text-secondary-dark transition-transform duration-200 ease-out",
                locale === "ar" ? "right-0" : "left-0",
                open ? "translate-x-0" : locale === "ar" ? "translate-x-full" : "-translate-x-full"
              )}
              role="dialog"
              aria-modal="true"
              aria-label="محتوى الدورة"
            >
              <div className="flex items-center justify-between border-b border-border-dark p-lg pb-4">
                <h2 className="truncate text-[16px] text-text-primary-dark">{courseTitle}</h2>
                <button onClick={() => setOpen(false)} aria-label="إغلاق" className="shrink-0 text-text-secondary-dark">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-1 flex-col overflow-hidden">
                <CourseContentTree
                  courseSlug={courseSlug}
                  sections={sections}
                  currentLessonId={currentLessonId}
                  hasAccess={hasAccess}
                  completedLessonIds={completedLessonIds}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
