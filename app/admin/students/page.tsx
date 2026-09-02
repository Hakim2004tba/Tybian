import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { PromoteToAdminButton } from "@/components/admin/PromoteToAdminButton";
import { listStudents } from "@/lib/data/admin-listings";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listStudents(page, params.q);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">إدارة الطلاب</Badge>
        <h1 className="mt-3 text-2xl">الطلاب</h1>
        <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> طالب</p>
      </div>

      <form method="GET" className="max-w-sm">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="ابحث بالاسم..."
          className="w-full rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary"
        />
      </form>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(s) => s.id}
          emptyLabel="لا يوجد طلاب"
          columns={[
            {
              header: "الاسم",
              cell: (s) => (
                <Link href={`/admin/students/${s.id}`} className="font-medium hover:text-primary">
                  {s.full_name}
                </Link>
              ),
            },
            { header: "السنة الدراسية", cell: (s) => s.academic_years?.name_ar ?? "—" },
            { header: "الهاتف", cell: (s) => <span className="num">{s.phone ?? "—"}</span> },
            { header: "تاريخ التسجيل", cell: (s) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(s.created_at))}</span> },
            {
              header: "",
              cell: (s) => <PromoteToAdminButton userId={s.id} userName={s.full_name} />,
            },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/students" currentParams={params} />
    </div>
  );
}
