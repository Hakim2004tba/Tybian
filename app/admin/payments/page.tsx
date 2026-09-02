import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { listPayments } from "@/lib/data/admin-listings";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
const currency = new Intl.NumberFormat("en-US");
const statusBadge: Record<string, { label: string; variant: "success" | "violet" | "error" | "muted" }> = {
  success: { label: "ناجح", variant: "success" },
  pending: { label: "قيد الانتظار", variant: "violet" },
  failed: { label: "فشل", variant: "error" },
  refunded: { label: "مسترجع", variant: "muted" },
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listPayments(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">المدفوعات</Badge>
        <h1 className="mt-3 text-2xl">المدفوعات</h1>
        <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> عملية دفع</p>
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(p) => p.id}
          emptyLabel="لا توجد مدفوعات بعد"
          columns={[
            { header: "الطالب", cell: (p) => p.profiles?.full_name ?? "—" },
            { header: "الدورة", cell: (p) => p.courses?.title ?? "—" },
            { header: "المبلغ", cell: (p) => <span className="num font-medium">{currency.format(Number(p.amount))} {p.currency}</span> },
            {
              header: "الحالة",
              cell: (p) => {
                const s = statusBadge[p.status] ?? { label: p.status, variant: "muted" as const };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
            { header: "التاريخ", cell: (p) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(p.created_at))}</span> },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/payments" currentParams={params} />
    </div>
  );
}
