import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionBlock } from "@/components/admin/courses/SectionBlock";
import { AddSectionForm } from "@/components/admin/courses/AddSectionForm";
import { getCourseStructure, getCourseForEdit } from "@/lib/data/admin-courses";

export default async function CourseStructurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, sections] = await Promise.all([getCourseForEdit(id), getCourseStructure(id)]);

  if (!course) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/courses/${id}`}
          className="flex w-fit items-center gap-1.5 text-[13.5px] text-text-muted-light hover:text-primary"
        >
          <ArrowRight size={14} />
          العودة إلى تفاصيل الدورة
        </Link>
        <Badge variant="violet" className="mt-3">هيكل الدورة</Badge>
        <h1 className="mt-3 text-2xl">{course.title}</h1>
        <p className="mt-1 text-text-secondary-light">
          <span className="num">{sections.length}</span> قسم ·{" "}
          <span className="num">{sections.reduce((n, s) => n + s.lessons.length, 0)}</span> درس
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((section, i) => (
          <SectionBlock
            key={section.id}
            section={section}
            courseId={id}
            isFirst={i === 0}
            isLast={i === sections.length - 1}
          />
        ))}
      </div>

      <AddSectionForm courseId={id} />
    </div>
  );
}
