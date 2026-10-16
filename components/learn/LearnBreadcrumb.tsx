import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDictionary } from "@/lib/i18n/locale";

export async function LearnBreadcrumb({
  courseSlug,
  courseTitle,
  lessonTitle,
}: {
  courseSlug: string;
  courseTitle: string;
  lessonTitle: string;
}) {
  const { dict } = await getDictionary();
  const t = dict.learn;
  return (
    <nav className="flex flex-wrap items-center gap-1.5 px-lg pt-lg text-[12.5px] text-text-muted-dark lg:px-xl">
      <Link href="/" className="hover:text-primary">
        {t.breadcrumbHome}
      </Link>
      <ChevronLeft size={13} />
      <Link href="/courses" className="hover:text-primary">
        {t.breadcrumbCourses}
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
