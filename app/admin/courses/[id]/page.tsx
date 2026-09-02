import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, PlayCircle, ListVideo, LayoutList, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { PricingForm } from "@/components/admin/courses/PricingForm";
import { CourseStatusActions } from "@/components/admin/courses/CourseStatusActions";
import { updateCourseAction } from "@/lib/admin/actions/courses";
import { getCourseForEdit, listTeachers, listAcademicYears } from "@/lib/data/admin-courses";

const statusBadge: Record<string, { label: string; variant: "success" | "muted" | "violet" }> = {
  published: { label: "منشورة", variant: "success" },
  draft: { label: "مسودة", variant: "muted" },
  archived: { label: "مؤرشفة", variant: "violet" },
};

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, teachers, academicYears] = await Promise.all([
    getCourseForEdit(id),
    listTeachers(),
    listAcademicYears(),
  ]);

  if (!course) notFound();

  const prices = (course.course_prices ?? []) as {
    plan_type: string;
    price: number;
    is_active: boolean;
  }[];
  const threeMonths = prices.find((p) => p.plan_type === "three_months" && p.is_active);
  const lifetime = prices.find((p) => p.plan_type === "lifetime" && p.is_active);

  const status = statusBadge[course.status] ?? { label: course.status, variant: "muted" as const };
  const action = updateCourseAction.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Badge variant="violet">تعديل الدورة</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <h1 className="mt-3 text-2xl">{course.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/courses/${id}/analytics`}>
            <Button variant="outline">
              <BarChart3 size={16} />
              التحليلات
            </Button>
          </Link>
          <Link href={`/admin/courses/${id}/structure`}>
            <Button variant="outline">
              <LayoutList size={16} />
              إدارة الأقسام والدروس
            </Button>
          </Link>
          <CourseStatusActions courseId={id} status={course.status} isFeatured={course.is_featured} />
        </div>
      </div>

      {/* Read-only stats — denormalized on `courses`, maintained by DB
          triggers (0007_functions_and_triggers.sql) from actual
          lessons/enrollments/reviews, never written by this UI. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock icon={Clock} value={`${course.duration_minutes} د`} label="مدة المحتوى" />
        <StatBlock icon={PlayCircle} value={String(course.videos_count)} label="عدد الفيديوهات" />
        <StatBlock icon={ListVideo} value={String(course.lessons_count)} label="عدد الدروس" />
        <StatBlock icon={LayoutList} value={String(course.students_count)} label="عدد الطلاب" />
      </div>

      <Card>
        <h3 className="mb-5 text-[16px]">تفاصيل الدورة</h3>
        <CourseForm
          action={action}
          submitLabel="حفظ التعديلات"
          teachers={teachers.map((t) => ({
            id: t.id,
            label: t.profiles?.full_name ?? t.title ?? "أستاذ بدون اسم",
          }))}
          academicYears={academicYears.map((y) => ({ id: y.id, label: y.name_ar }))}
          initial={{
            title: course.title,
            slug: course.slug,
            teacherId: course.teacher_id,
            academicYearId: course.academic_year_id,
            level: course.level,
            description: course.description ?? "",
            shortDescription: course.short_description ?? "",
            coverUrl: course.cover_url ?? "",
            tags: course.tags ?? [],
            learningOutcomes: course.learning_outcomes ?? [],
          }}
        />
      </Card>

      <Card className="max-w-xl">
        <h3 className="mb-1 text-[16px]">التسعير</h3>
        <p className="mb-5 text-[13px] text-text-muted-light">
          التسعير محصور بالمشرف فقط، حتى على دورات الأستاذ نفسه.
        </p>
        <PricingForm
          courseId={id}
          threeMonthsPrice={threeMonths?.price ?? null}
          lifetimePrice={lifetime?.price ?? null}
        />
      </Card>
    </div>
  );
}

function StatBlock({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Clock;
  value: string;
  label: string;
}) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div>
        <div className="num text-[18px] font-bold">{value}</div>
        <div className="text-[12px] text-text-muted-light">{label}</div>
      </div>
    </Card>
  );
}
