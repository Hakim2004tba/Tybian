import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getStudySubjectDetail, getSubjectStudentProgress } from "@/lib/data/study-tracking";
import { getAcademicYears } from "@/lib/data/academic-years";
import { SubjectManager } from "@/components/admin/study/SubjectManager";

/**
 * The admin's editor for one subject.
 *
 * getStudySubjectDetail is called WITHOUT a userId, so no marks are
 * merged onto the lessons: this screen edits the syllabus, and showing
 * one particular person's checkmarks in an editor would mislead. Student
 * progress appears aggregated in its own panel.
 */
export default async function AdminStudySubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;

  const [subject, years, progress] = await Promise.all([
    getStudySubjectDetail(subjectId),
    getAcademicYears(),
    getSubjectStudentProgress(subjectId),
  ]);

  if (!subject) notFound();

  return (
    <div className="flex flex-col gap-lg">
      <Link
        href="/admin/study-tracking"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary-light transition-colors hover:text-primary"
      >
        <ArrowRight size={15} />
        كل المواد
      </Link>

      <SubjectManager subject={subject} years={years} students={progress.students} />
    </div>
  );
}
