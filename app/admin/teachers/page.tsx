import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/dashboard/Pagination";
import { CreateTeacherForm } from "@/components/admin/CreateTeacherForm";
import { TeacherRow } from "@/components/admin/TeacherRow";
import { listTeachersAdmin } from "@/lib/data/admin-listings";
import { teacherEarnings } from "@/lib/data/teacher-earnings";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, totalCount, pageSize } = await listTeachersAdmin(page);
  /* Empty before migration 20, which hides the payout block. */
  const earnings = await teacherEarnings();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet">إدارة الأساتذة</Badge>
          <h1 className="mt-3 text-2xl">الأساتذة</h1>
          <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> أستاذ</p>
        </div>
        <CreateTeacherForm />
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="text-[14px] text-text-secondary-light">لا يوجد أساتذة بعد.</p>
        ) : (
          items.map((t) => (
            <TeacherRow
              key={t.id}
              teacher={{
                id: t.id,
                profileId: t.profile_id,
                title: t.title,
                specialty: t.specialty,
                institution: t.institution,
                bio: t.bio,
                rating: t.rating,
                students_count: t.students_count,
                revenue: t.revenue,
                paidOrders: t.paidOrders,
                lastSaleAt: t.lastSaleAt,
                earnings: earnings.get(t.id) ?? null,
                courses_count: t.courses_count,
                fullName: t.profiles?.full_name ?? "—",
                avatarUrl: t.profiles?.avatar_url ?? null,
              }}
            />
          ))
        )}
      </div>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/teachers" currentParams={params} />
    </div>
  );
}
