import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { listPricingOverview } from "@/lib/data/admin-listings";

const currency = new Intl.NumberFormat("en-US");

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listPricingOverview(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">التسعير</Badge>
        <h1 className="mt-3 text-2xl">تسعير الدورات</h1>
        <p className="mt-1 text-text-secondary-light">
          نظرة عامة على أسعار كل الدورات — للتعديل، افتح صفحة الدورة نفسها.
        </p>
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(p) => p.courseId}
          emptyLabel="لا توجد دورات بعد"
          columns={[
            {
              header: "الدورة",
              cell: (p) => (
                <Link href={`/admin/courses/${p.courseId}`} className="font-medium hover:text-primary">
                  {p.courseTitle}
                </Link>
              ),
            },
            {
              header: "3 أشهر",
              cell: (p) => p.threeMonthsPrice !== null ? <span className="num">{currency.format(p.threeMonthsPrice)} دج</span> : <span className="text-text-muted-light">—</span>,
            },
            {
              header: "مدى الحياة",
              cell: (p) => p.lifetimePrice !== null ? <span className="num text-gold">{currency.format(p.lifetimePrice)} دج</span> : <span className="text-text-muted-light">—</span>,
            },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/pricing" currentParams={params} />
    </div>
  );
}
