import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { createCourseAction } from "@/lib/admin/actions/courses";
import { listTeachers, listAcademicYears } from "@/lib/data/admin-courses";

export default async function NewCoursePage() {
  const [teachers, academicYears] = await Promise.all([listTeachers(), listAcademicYears()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">دورة جديدة</Badge>
        <h1 className="mt-3 text-2xl">إنشاء دورة</h1>
        <p className="mt-1 text-text-secondary-light">
          تُنشأ الدورة كمسودة — يمكن نشرها لاحقاً بعد إضافة الأقسام والدروس.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CourseForm
          action={createCourseAction}
          submitLabel="إنشاء الدورة"
          teachers={teachers.map((t) => ({
            id: t.id,
            label: t.profiles?.full_name ?? t.title ?? "أستاذ بدون اسم",
          }))}
          academicYears={academicYears.map((y) => ({ id: y.id, label: y.name_ar }))}
        />
      </Card>
    </div>
  );
}
