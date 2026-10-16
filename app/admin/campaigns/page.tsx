import { Mail } from "lucide-react";
import { requireRouteAccess } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { campaignsReady } from "@/lib/admin/actions/campaigns";
import { CampaignComposer } from "@/components/admin/campaigns/CampaignComposer";

export const dynamic = "force-dynamic";

/**
 * Announcements — one message to everyone, or to one course's students.
 *
 * Exists so a new course or an exam reminder does not mean exporting
 * addresses into a third-party tool: the list never leaves the
 * platform, and what was sent to whom is recorded here.
 */
export default async function AdminCampaignsPage() {
  await requireRouteAccess("/admin");

  if (!(await campaignsReady())) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text-primary-light">الرسائل الجماعية</h1>
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          شغّل <span className="num">tibyan-db/mysql/17-campaigns.sql</span> في phpMyAdmin أولاً.
        </p>
      </div>
    );
  }

  const [courses, years, recent] = await Promise.all([
    query<{ id: string; title: string }>(
      `SELECT id, title FROM courses WHERE status = 'published' ORDER BY title ASC`
    ),
    query<{ id: string; name_ar: string }>(
      `SELECT id, name_ar FROM academic_years ORDER BY year_number ASC`
    ),
    query<{
      id: string; subject: string; status: string;
      total_count: number; sent_count: number; failed_count: number; created_at: string;
    }>(
      `SELECT id, subject, status, total_count, sent_count, failed_count, created_at
         FROM email_campaigns ORDER BY created_at DESC LIMIT 10`
    ),
  ]);

  return (
    <div>
      <header>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <Mail size={20} className="text-primary" />
          الرسائل الجماعية
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          رسالة واحدة إلى كل المسجّلين، أو إلى طلبة دورة أو سنة بعينها. تُرسَل إلى
          الحسابات المفعَّلة فقط.
        </p>
      </header>

      <div className="mt-6">
        <CampaignComposer courses={courses} years={years} />
      </div>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">أُرسلت مؤخّراً</h2>
          <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
            <table className="w-full text-[13px]">
              <thead className="border-b border-border-light text-[12px] text-text-muted-light">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">العنوان</th>
                  <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                  <th className="px-4 py-2.5 text-start font-medium">وصلت</th>
                  <th className="px-4 py-2.5 text-start font-medium">فشلت</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id} className="border-b border-border-light last:border-0">
                    <td className="px-4 py-2.5">{c.subject}</td>
                    <td className="px-4 py-2.5 text-text-secondary-light">
                      {c.status === "sent" ? "تمّت" : c.status === "sending" ? "قيد الإرسال" : c.status}
                    </td>
                    <td className="num px-4 py-2.5">{c.sent_count} / {c.total_count}</td>
                    <td className="num px-4 py-2.5 text-text-muted-light">{c.failed_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
