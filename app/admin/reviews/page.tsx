import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { listReviewsAdmin } from "@/lib/data/admin-listings";
import { DeleteReviewButton } from "@/components/admin/reviews/DeleteReviewButton";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listReviewsAdmin(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">التقييمات</Badge>
        <h1 className="mt-3 text-2xl">تقييمات الطلاب</h1>
        <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> تقييم</p>
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(r) => r.id}
          emptyLabel="لا توجد تقييمات بعد"
          columns={[
            { header: "الطالب", cell: (r) => r.profiles?.full_name ?? "—" },
            { header: "الدورة", cell: (r) => r.courses?.title ?? "—" },
            { header: "التقييم", cell: (r) => <span className="num text-gold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> },
            { header: "التعليق", cell: (r) => <span className="line-clamp-1 max-w-[260px] text-text-secondary-light">{r.comment ?? "—"}</span> },
            { header: "التاريخ", cell: (r) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(r.created_at))}</span> },
            { header: "", cell: (r) => <DeleteReviewButton reviewId={r.id} /> },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/reviews" currentParams={params} />
    </div>
  );
}
