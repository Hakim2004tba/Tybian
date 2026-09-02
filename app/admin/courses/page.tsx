import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminTable } from "@/components/admin/AdminTable";
import { CourseStatusActions } from "@/components/admin/courses/CourseStatusActions";
import { listCourses } from "@/lib/data/admin-courses";

const statusBadge: Record<string, { label: string; variant: "success" | "muted" | "violet" }> = {
  published: { label: "منشورة", variant: "success" },
  draft: { label: "مسودة", variant: "muted" },
  archived: { label: "مؤرشفة", variant: "violet" },
};

const levelLabel: Record<string, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
};

export default async function AdminCoursesPage() {
  const courses = await listCourses();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet">إدارة الدورات</Badge>
          <h1 className="mt-3 text-2xl">الدورات</h1>
          <p className="mt-1 text-text-secondary-light">
            <span className="num">{courses.length}</span> دورة
          </p>
        </div>
        <Link href="/admin/courses/new">
          <Button>
            <Plus size={17} />
            دورة جديدة
          </Button>
        </Link>
      </div>

      <Card padded={false}>
        <AdminTable
          rows={courses}
          rowKey={(c) => c.id}
          emptyLabel="لا توجد دورات بعد"
          columns={[
            {
              header: "الدورة",
              cell: (c) => (
                <Link href={`/admin/courses/${c.id}`} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-text-primary-light hover:text-primary">{c.title}</div>
                    <div className="num text-[12px] text-text-muted-light">{c.slug}</div>
                  </div>
                </Link>
              ),
            },
            {
              header: "السنة",
              cell: (c) => c.academic_years?.name_ar ?? "—",
            },
            {
              header: "الأستاذ",
              cell: (c) => c.teachers?.profiles?.full_name ?? "—",
            },
            {
              header: "المستوى",
              cell: (c) => levelLabel[c.level] ?? c.level,
            },
            {
              header: "الدروس",
              cell: (c) => <span className="num">{c.lessons_count}</span>,
            },
            {
              header: "الطلاب",
              cell: (c) => <span className="num">{c.students_count}</span>,
            },
            {
              header: "التقييم",
              cell: (c) => <span className="num">★ {c.rating.toFixed(1)}</span>,
            },
            {
              header: "الحالة",
              cell: (c) => {
                const s = statusBadge[c.status] ?? { label: c.status, variant: "muted" as const };
                return (
                  <div className="flex items-center gap-1.5">
                    <Badge variant={s.variant}>{s.label}</Badge>
                    {c.is_featured && <Badge variant="gold">مميّزة</Badge>}
                  </div>
                );
              },
            },
            {
              header: "",
              cell: (c) => <CourseStatusActions courseId={c.id} status={c.status} isFeatured={c.is_featured} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
