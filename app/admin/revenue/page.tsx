import { TrendingUp, Layers, BookOpen } from "lucide-react";
import { requireRouteAccess } from "@/lib/auth/session";
import { revenueReport } from "@/lib/data/revenue-report";
import { columnExists } from "@/lib/db/tables";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-US");

/**
 * Where the money came from, per course and per pack.
 *
 * Exists because the teachers page answers a narrower question: it
 * reads payments.course_id, so a course that only ever sold inside a
 * pack showed nothing. Here a pack sale is divided between its courses
 * and counted on both sides.
 */
export default async function AdminRevenuePage() {
  await requireRouteAccess("/admin");

  const { courses, packs } = await revenueReport();
  const ready = await columnExists("enrollments", "pack_id");

  return (
    <div>
      <header>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <TrendingUp size={20} className="text-primary" />
          الدخل لكل دورة وباقة
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          المبالغ المدفوعة فقط — لا تشمل ما مُنح مجّاناً. ودخل الباقة يُقسَّم على
          دوراتها حسب وزن كل دورة.
        </p>
      </header>

      {!ready && (
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          شغّل <span className="num">tibyan-db/mysql/22-pack-revenue.sql</span> لتفصيل
          «مباشرة / عبر باقة».
        </p>
      )}

      {/* ---- packs ---- */}
      <section className="mt-6">
        <h2 className="mb-2.5 flex items-center gap-2 text-[16px] font-semibold text-text-primary-light">
          <Layers size={17} className="text-primary" />
          الباقات
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="border-b border-border-light text-[12px] text-text-muted-light">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">الباقة</th>
                <th className="px-4 py-2.5 text-start font-medium">عدد المشترين</th>
                <th className="px-4 py-2.5 text-start font-medium">المشتركون الحاليون</th>
                <th className="px-4 py-2.5 text-start font-medium">الدخل</th>
              </tr>
            </thead>
            <tbody>
              {packs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-muted-light">
                    لا توجد باقات.
                  </td>
                </tr>
              ) : (
                packs.map((p) => (
                  <tr key={p.packId} className="border-b border-border-light last:border-0">
                    <td className="px-4 py-2.5">{p.title}</td>
                    <td className="num px-4 py-2.5">{p.buyers}</td>
                    <td className="num px-4 py-2.5">{p.subscribers}</td>
                    <td className="num px-4 py-2.5 font-semibold text-success">
                      {money(p.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- courses ---- */}
      <section className="mt-8">
        <h2 className="mb-2.5 flex items-center gap-2 text-[16px] font-semibold text-text-primary-light">
          <BookOpen size={17} className="text-primary" />
          الدورات
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="border-b border-border-light text-[12px] text-text-muted-light">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">الدورة</th>
                <th className="px-4 py-2.5 text-start font-medium">مباشرة</th>
                <th className="px-4 py-2.5 text-start font-medium">عبر باقة</th>
                <th className="px-4 py-2.5 text-start font-medium">منحة</th>
                <th className="px-4 py-2.5 text-start font-medium">دخل مباشر</th>
                <th className="px-4 py-2.5 text-start font-medium">حصّة من الباقات</th>
                <th className="px-4 py-2.5 text-start font-medium">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.courseId} className="border-b border-border-light last:border-0">
                  <td className="px-4 py-2.5">{c.title}</td>
                  <td className="num px-4 py-2.5">{c.directStudents}</td>
                  <td className="num px-4 py-2.5">{c.packStudents}</td>
                  <td className="num px-4 py-2.5 text-text-muted-light">{c.grantedStudents}</td>
                  <td className="num px-4 py-2.5">{money(c.directRevenue)}</td>
                  <td className="num px-4 py-2.5">{money(c.packRevenue)}</td>
                  <td className="num px-4 py-2.5 font-semibold text-success">{money(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
