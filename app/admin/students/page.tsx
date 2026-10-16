import Link from "next/link";
import { query } from "@/lib/db";
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
  searchParams: Promise<{ page?: string; q?: string; year?: string; enrolled?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [{ items, totalCount, pageSize }, years] = await Promise.all([
    listStudents(page, {
      q: params.q,
      year: params.year,
      enrolled: params.enrolled,
      sort: params.sort,
    }),
    query<{ id: string; name_ar: string }>(
      `SELECT id, name_ar FROM academic_years ORDER BY sort_order ASC`
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">إدارة الطلاب</Badge>
        <h1 className="mt-3 text-2xl">الطلاب</h1>
        <p className="mt-1 text-text-secondary-light"><span className="num">{totalCount}</span> طالب</p>
      </div>

      {/*
        A plain GET form, so every filtered view is a real URL the admin
        can bookmark, share, or come back to after opening a student.
        No client state, and the browser's back button does the right
        thing on its own.
      */}
      <form method="GET" className="flex flex-wrap items-end gap-2">
        <label className="flex w-full flex-1 flex-col gap-1.5 sm:min-w-[200px]">
          <span className="text-[12.5px] font-semibold text-text-secondary-light">الاسم</span>
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="ابحث بالاسم..."
            className="w-full rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-secondary-light">السنة</span>
          <select
            name="year"
            defaultValue={params.year ?? ""}
            className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px]"
          >
            <option value="">كل السنوات</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name_ar}</option>
            ))}
            {/* The accounts that look broken to whoever holds them: no
                year means an almost empty library. */}
            <option value="none">بلا سنة محدّدة</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-secondary-light">التسجيل</span>
          <select
            name="enrolled"
            defaultValue={params.enrolled ?? ""}
            className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px]"
          >
            <option value="">الكل</option>
            <option value="yes">مسجَّل في دورة</option>
            <option value="no">لم يسجّل بعد</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-secondary-light">الترتيب</span>
          <select
            name="sort"
            defaultValue={params.sort ?? "newest"}
            className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px]"
          >
            <option value="newest">الأحدث تسجيلاً</option>
            <option value="oldest">الأقدم</option>
            <option value="name">الاسم</option>
            <option value="courses">الأكثر دورات</option>
          </select>
        </label>

        <button className="rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-white">
          تطبيق
        </button>
        <Link href="/admin/students" className="px-2 py-2.5 text-[13px] text-text-secondary-light hover:text-primary">
          إعادة تعيين
        </Link>
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
            {
              header: "الدورات",
              cell: (s) =>
                s.courseCount && s.courseCount > 0 ? (
                  <span className="num font-semibold text-primary">{s.courseCount}</span>
                ) : (
                  <span className="text-text-muted-light">—</span>
                ),
            },
            { header: "الهاتف", cell: (s) => <span className="num">{s.phone ?? "—"}</span> },
            { header: "تاريخ التسجيل", cell: (s) => <span className="num text-text-muted-light">{dateFormatter.format(new Date(s.created_at))}</span> },
            {
              header: "",
              /*
                Promotion is rare and permanent-feeling, so it no longer
                sits in every row shouting. It fades in on hover and
                stays reachable by keyboard focus — present for the once
                a term it is used, invisible the rest of the time.
              */
              cell: (s) => (
                <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
                  <PromoteToAdminButton userId={s.id} userName={s.full_name} />
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} paramName="page" basePath="/admin/students" currentParams={params} />
    </div>
  );
}
