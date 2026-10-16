import { Paperclip } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { JumpToCourseStructure } from "@/components/admin/JumpToCourseStructure";
import { listLessonsAdmin } from "@/lib/data/admin-listings";
import { listCourses } from "@/lib/data/admin-courses";

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [{ items, totalCount, pageSize }, courses] = await Promise.all([
    listLessonsAdmin(page),
    listCourses(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="violet">الدروس</Badge>
          <h1 className="mt-3 text-2xl">كل الدروس</h1>
          <p className="mt-1 text-text-secondary-light">
            <span className="num">{totalCount}</span> درس عبر كل الدورات
          </p>
        </div>
        <JumpToCourseStructure
          courses={courses.map((c) => ({ id: c.id, title: c.title }))}
          label="إضافة درس"
        />
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(l) => l.id}
          emptyLabel="لا توجد دروس بعد"
          columns={[
            { header: "الدرس", cell: (l) => <span className="font-medium">{l.title}</span> },
            { header: "الدورة", cell: (l) => l.courseTitle ?? "—" },
            { header: "القسم", cell: (l) => l.sectionTitle ?? "—" },
            { header: "الفيديو", cell: (l) => <Badge variant={l.hasVideo ? "success" : "muted"}>{l.hasVideo ? "مرفق" : "غير مرفق"}</Badge> },
            { header: "المعاينة", cell: (l) => l.is_free_preview ? <Badge variant="teal">مجانية</Badge> : <span className="text-text-muted-light">—</span> },
            {
              header: "المرفقات",
              cell: (l) => (
                <Link
                  href={`/admin/lessons/${l.id}/resources`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                >
                  <Paperclip size={13} />
                  {l.resourceCount > 0 ? <span className="num">{l.resourceCount}</span> : "أضف"}
                </Link>
              ),
            },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/lessons" currentParams={params} />
    </div>
  );
}
