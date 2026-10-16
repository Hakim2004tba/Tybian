import Link from "next/link";
import { BookMarked, ListChecks, Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listStudySubjects } from "@/lib/data/study-tracking";
import { getAcademicYears } from "@/lib/data/academic-years";
import { CreateSubjectForm } from "@/components/admin/study/CreateSubjectForm";

/**
 * Admin index for the study tracker: every subject (matière) authored,
 * plus the create form. Structure only — a subject's student progress
 * lives on its own page, next to the syllabus those numbers refer to.
 */
export default async function AdminStudyTrackingPage() {
  const [subjects, years] = await Promise.all([listStudySubjects(), getAcademicYears()]);

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="flex items-center gap-2.5 text-[22px]">
          <Target size={22} className="text-primary" strokeWidth={1.75} />
          تتبّع الدراسة
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          أنشئ المواد والدروس داخل كل مادة. الطالب يتابع تقدّمه على هذه الدروس ويحدّد تاريخ امتحانه
          بنفسه — ولا يستطيع تعديل المواد أو الدروس.
        </p>
      </header>

      <CreateSubjectForm years={years} />

      {subjects.length === 0 ? (
        <Card className="text-center">
          <BookMarked size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">
            لا توجد مواد بعد — أنشئ أول مادة من النموذج أعلاه.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <Link key={s.id} href={`/admin/study-tracking/${s.id}`}>
              <Card interactive className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[16px] font-semibold text-text-primary-light">{s.title}</h2>
                  <Badge variant={s.isPublished ? "teal" : "gold"}>
                    {s.isPublished ? "منشورة" : "مسودة"}
                  </Badge>
                </div>
                {s.description && (
                  <p className="mt-1 line-clamp-1 text-[12.5px] text-text-muted-light">{s.description}</p>
                )}
                <div className="mt-4 flex items-center gap-1.5 text-[12.5px] text-text-secondary-light">
                  <ListChecks size={14} className="text-primary" />
                  <span className="num">{s.itemCount}</span> دروس
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
