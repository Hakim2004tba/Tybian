import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { listEnrollments } from "@/lib/data/admin-listings";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
const planLabel: Record<string, string> = { three_months: "3 أشهر", lifetime: "مدى الحياة" };

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listEnrollments(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">التسجيلات</Badge>
        <h1 className="mt-3 text-2xl">التسجيلات</h1>
        <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> تسجيل</p>
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(e) => e.id}
          emptyLabel="لا توجد تسجيلات بعد"
          columns={[
            { header: "الطالب", cell: (e) => e.profiles?.full_name ?? "—" },
            { header: "الدورة", cell: (e) => e.courses?.title ?? "—" },
            { header: "الخطة", cell: (e) => <Badge variant={e.plan_type === "lifetime" ? "gold" : "violet"}>{planLabel[e.plan_type] ?? e.plan_type}</Badge> },
            { header: "تاريخ البدء", cell: (e) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(e.starts_at))}</span> },
            { header: "الانتهاء", cell: (e) => <span className="num text-text-muted-light">{e.expires_at ? dateFormatter.format(new Date(e.expires_at)) : "مدى الحياة"}</span> },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/enrollments" currentParams={params} />
    </div>
  );
}
