import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminTable } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/dashboard/Pagination";
import { ArticleStatusActions } from "@/components/admin/articles/ArticleStatusActions";
import { listArticlesAdmin } from "@/lib/data/admin-articles";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listArticlesAdmin(page);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet">إدارة المقالات</Badge>
          <h1 className="mt-3 text-2xl">المقالات</h1>
          <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> مقال</p>
        </div>
        <Link href="/admin/articles/new">
          <Button>
            <Plus size={16} />
            مقال جديد
          </Button>
        </Link>
      </div>

      <Card padded={false}>
        <AdminTable
          rows={items}
          rowKey={(a) => a.id}
          emptyLabel="لا توجد مقالات بعد"
          columns={[
            {
              header: "العنوان",
              cell: (a) => (
                <Link href={`/admin/articles/${a.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                  <FileText size={15} className="text-text-muted-light" />
                  {a.title}
                </Link>
              ),
            },
            {
              header: "الحالة",
              cell: (a) => <Badge variant={a.is_published ? "success" : "muted"}>{a.is_published ? "منشور" : "مسودة"}</Badge>,
            },
            { header: "التاريخ", cell: (a) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(a.created_at))}</span> },
            {
              header: "",
              cell: (a) => <ArticleStatusActions articleId={a.id} isPublished={a.is_published} redirectOnDeleteTo="/admin/articles" />,
            },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/articles" currentParams={params} />
    </div>
  );
}
