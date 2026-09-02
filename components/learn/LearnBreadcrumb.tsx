import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function LearnBreadcrumb({
  courseSlug,
  courseTitle,
  lessonTitle,
}: {
  courseSlug: string;
  courseTitle: string;
  lessonTitle: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 px-lg pt-lg text-[12.5px] text-text-muted-dark lg:px-xl">
      <Link href="/" className="hover:text-primary">
        الرئيسية
      </Link>
      <ChevronLeft size={13} />
      <Link href="/courses" className="hover:text-primary">
        الدورات
      </Link>
      <ChevronLeft size={13} />
      <Link href={`/courses/${courseSlug}`} className="hover:text-primary">
        {courseTitle}
      </Link>
      <ChevronLeft size={13} />
      <span className="truncate text-text-secondary-dark">{lessonTitle}</span>
    </nav>
  );
}
