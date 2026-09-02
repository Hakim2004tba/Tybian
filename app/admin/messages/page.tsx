import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/dashboard/Pagination";
import { MessageRow } from "@/components/admin/MessageRow";
import { listContactMessages } from "@/lib/data/admin-messages";

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listContactMessages(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">رسائل التواصل</Badge>
        <h1 className="mt-3 text-2xl">رسائل التواصل معنا</h1>
        <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> رسالة</p>
      </div>

      <div className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-[14px] text-text-secondary-light">لا توجد رسائل بعد.</p>
        ) : (
          items.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/messages" currentParams={params} />
    </div>
  );
}
