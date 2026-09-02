import { Youtube, Cloud } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { JumpToCourseStructure } from "@/components/admin/JumpToCourseStructure";
import { listVideosAdmin } from "@/lib/data/admin-listings";
import { listCourses } from "@/lib/data/admin-courses";

const statusBadge: Record<string, { label: string; variant: "success" | "muted" | "error" }> = {
  ready: { label: "جاهز", variant: "success" },
  processing: { label: "قيد المعالجة", variant: "muted" },
  failed: { label: "فشل", variant: "error" },
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [{ items, totalCount, pageSize }, courses] = await Promise.all([
    listVideosAdmin(page),
    listCourses(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="violet">الفيديوهات</Badge>
          <h1 className="mt-3 text-2xl">مكتبة الفيديوهات</h1>
          <p className="mt-1 text-text-secondary-light">
            <span className="num">{totalCount}</span> فيديو — من Bunny Stream أو يوتيوب
          </p>
        </div>
        <JumpToCourseStructure
          courses={courses.map((c) => ({ id: c.id, title: c.title }))}
          label="رفع فيديو"
        />
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(v) => v.id}
          emptyLabel="لا توجد فيديوهات مرفوعة بعد"
          columns={[
            { header: "العنوان", cell: (v) => <span className="font-medium">{v.title}</span> },
            {
              header: "المصدر",
              cell: (v) =>
                v.source === "youtube" ? (
                  <Badge variant="error" className="flex w-fit items-center gap-1">
                    <Youtube size={11} /> YouTube
                  </Badge>
                ) : (
                  <Badge variant="violet" className="flex w-fit items-center gap-1">
                    <Cloud size={11} /> Bunny
                  </Badge>
                ),
            },
            { header: "الدرس", cell: (v) => v.lessonTitle ?? "غير مرتبط" },
            { header: "الدورة", cell: (v) => v.courseTitle ?? "—" },
            { header: "المدة", cell: (v) => <span className="num">{formatDuration(v.duration_seconds)}</span> },
            {
              header: "الحالة",
              cell: (v) => {
                const s = statusBadge[v.status] ?? { label: v.status, variant: "muted" as const };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/videos" currentParams={params} />
    </div>
  );
}
