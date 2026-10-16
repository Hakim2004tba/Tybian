import { Ticket } from "lucide-react";
import { query } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { CouponForm } from "@/components/admin/promo/CouponForm";
import { ToggleCoupon } from "@/components/admin/promo/ToggleCoupon";

export const dynamic = "force-dynamic";

export default async function AdminPromoPage() {
  await requireRouteAccess("/admin");
  const { dict, locale } = await getDictionary();
  const t = dict.admin.promo;

  const [coupons, courses, packs] = await Promise.all([
    query<{
      id: string; code: string; discount_type: string; discount_value: string;
      max_uses: number | null; uses_count: number; expires_at: string | null;
      is_active: number; course_title: string | null;
    }>(
      `SELECT c.id, c.code, c.discount_type, c.discount_value, c.max_uses, c.uses_count,
              c.expires_at, c.is_active, co.title AS course_title
         FROM coupons c
         LEFT JOIN courses co ON co.id = c.applicable_course_id
        WHERE c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 200`
    ),
    query<{ id: string; title: string }>(
      `SELECT id, title FROM courses WHERE deleted_at IS NULL ORDER BY title LIMIT 300`
    ),
    /* Empty before 07-packs.sql; the pack selector just does not
       appear, which is correct when there are no packs to pin to. */
    query<{ id: string; title: string }>(
      `SELECT id, title FROM course_packs WHERE deleted_at IS NULL ORDER BY sort_order, title LIMIT 200`
    ),
  ]);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">{t.existing}</h2>

          {coupons.length === 0 ? (
            <div className="rounded-xl border border-border-light bg-white px-lg py-12 text-center">
              <Ticket size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] text-text-secondary-light">{t.none}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {coupons.map((c) => (
                <li key={c.id} className="rounded-xl border border-border-light bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="num rounded-md bg-primary/10 px-2.5 py-1 text-[14px] font-bold tracking-wide text-primary">
                      {c.code}
                    </span>
                    <span
                      className={
                        c.is_active === 1
                          ? "rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success"
                          : "rounded-full bg-bg-light px-2.5 py-0.5 text-[11px] font-semibold text-text-muted-light"
                      }
                    >
                      {c.is_active === 1 ? t.active : t.inactive}
                    </span>
                  </div>

                  <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-secondary-light">
                    <span className="num font-semibold text-text-primary-light">
                      {c.discount_type === "percentage"
                        ? `${Number(c.discount_value)}%`
                        : `${Number(c.discount_value)} ${dict.search.currency}`}
                    </span>
                    <span>
                      {t.uses} <span className="num">{c.uses_count}</span> {t.of}{" "}
                      <span className="num">{c.max_uses ?? t.unlimited}</span>
                    </span>
                    {c.expires_at && (
                      <span className="num">
                        {fmt.format(new Date(`${c.expires_at.replace(" ", "T")}Z`))}
                      </span>
                    )}
                    <span>{c.course_title ?? t.anyCourse}</span>
                  </p>

                  <div className="mt-2.5">
                    <ToggleCoupon couponId={c.id} isActive={c.is_active === 1} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-4 text-[15px] font-semibold text-text-primary-light">{t.create}</h2>
          <CouponForm courses={courses} packs={packs} />
        </aside>
      </div>
    </div>
  );
}
