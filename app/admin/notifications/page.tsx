import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { BroadcastForm } from "@/components/admin/BroadcastForm";
import { listSentNotifications } from "@/lib/data/admin-listings";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listSentNotifications(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">الإشعارات</Badge>
        <h1 className="mt-3 text-2xl">الإشعارات</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <BroadcastForm />

        <div className="flex flex-col gap-4">
          <Card padded={false}>
            <div className="border-b border-border-light p-lg pb-4">
              <h3 className="text-[15px]">سجل الإشعارات المُرسَلة</h3>
            </div>
            <AdminTable
              rows={items}
              rowKey={(n) => n.id}
              emptyLabel="لم تُرسَل أي إشعارات بعد"
              columns={[
                { header: "العنوان", cell: (n) => <span className="font-medium">{n.title}</span> },
                { header: "المستلمون", cell: (n) => <span className="num">{n.recipientCount}</span> },
                { header: "التاريخ", cell: (n) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(n.created_at))}</span> },
              ]}
            />
          </Card>
          <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/notifications" currentParams={params} />
        </div>
      </div>
    </div>
  );
}
