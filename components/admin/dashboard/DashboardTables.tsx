import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AdminTable } from "@/components/admin/AdminTable";
import { getRecentStudents, getRecentPayments, getRecentReviews } from "@/lib/data/admin-dashboard";

const currency = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });

const statusBadge: Record<string, { label: string; variant: "success" | "violet" | "error" | "muted" }> = {
  success: { label: "ناجح", variant: "success" },
  pending: { label: "قيد الانتظار", variant: "violet" },
  failed: { label: "فشل", variant: "error" },
  refunded: { label: "مسترجع", variant: "muted" },
};

const planLabel: Record<string, string> = {
  three_months: "3 أشهر",
  lifetime: "مدى الحياة",
};

export async function RecentStudentsTable() {
  const students = await getRecentStudents();

  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="text-[15px]">أحدث الطلاب</h3>
      </div>
      <AdminTable
        rows={students}
        rowKey={(s) => s.id}
        emptyLabel="لا يوجد طلاب مسجّلون بعد"
        columns={[
          { header: "الاسم", cell: (s) => <span className="font-medium">{s.full_name}</span> },
          {
            header: "السنة الدراسية",
            cell: (s) => (s.academic_years as unknown as { name_ar: string } | null)?.name_ar ?? "—",
          },
          {
            header: "تاريخ التسجيل",
            cell: (s) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(s.created_at))}</span>,
          },
        ]}
      />
    </Card>
  );
}

export async function RecentPaymentsTable() {
  const payments = await getRecentPayments();

  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="text-[15px]">أحدث المدفوعات</h3>
      </div>
      <AdminTable
        rows={payments}
        rowKey={(p) => p.id}
        emptyLabel="لا توجد مدفوعات بعد"
        columns={[
          {
            header: "الطالب",
            cell: (p) => (p.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
          },
          {
            header: "الدورة",
            cell: (p) => (p.courses as unknown as { title: string } | null)?.title ?? "—",
          },
          { header: "الخطة", cell: (p) => planLabel[p.plan_type] ?? p.plan_type },
          {
            header: "المبلغ",
            cell: (p) => <span className="num font-medium">{currency.format(Number(p.amount))} {p.currency}</span>,
          },
          {
            header: "الحالة",
            cell: (p) => {
              const s = statusBadge[p.status] ?? { label: p.status, variant: "muted" as const };
              return <Badge variant={s.variant}>{s.label}</Badge>;
            },
          },
        ]}
      />
    </Card>
  );
}

export async function RecentReviewsTable() {
  const reviews = await getRecentReviews();

  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="text-[15px]">أحدث التقييمات</h3>
      </div>
      <AdminTable
        rows={reviews}
        rowKey={(r) => r.id}
        emptyLabel="لا توجد تقييمات بعد"
        columns={[
          {
            header: "الطالب",
            cell: (r) => (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
          },
          {
            header: "الدورة",
            cell: (r) => (r.courses as unknown as { title: string } | null)?.title ?? "—",
          },
          {
            header: "التقييم",
            cell: (r) => <span className="num text-gold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>,
          },
          {
            header: "التعليق",
            cell: (r) => <span className="line-clamp-1 max-w-[220px] text-text-secondary-light">{r.comment ?? "—"}</span>,
          },
        ]}
      />
    </Card>
  );
}
