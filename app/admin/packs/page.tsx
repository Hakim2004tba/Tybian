import { Layers } from "lucide-react";
import { query } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { packsReady } from "@/lib/data/packs";
import { PackForm } from "@/components/admin/packs/PackForm";
import { TogglePack } from "@/components/admin/packs/TogglePack";
import { tablesExist, columnExists } from "@/lib/db/tables";
import { PackPricingForm } from "@/components/admin/packs/PackPricingForm";
import { PackWeightsForm } from "@/components/admin/packs/PackWeightsForm";

export const dynamic = "force-dynamic";

export default async function AdminPacksPage() {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();
  const t = dict.admin.packs;

  const ready = await packsReady();

  const courses = await query<{ id: string; title: string; price: string | null }>(
    `SELECT c.id, c.title,
            (SELECT MIN(p.price) FROM course_prices p WHERE p.course_id = c.id AND p.is_active = 1) AS price
       FROM courses c
      WHERE c.deleted_at IS NULL
      ORDER BY c.title
      LIMIT 300`
  );

  /* Read directly rather than through listPacks(): the admin must see
     disabled packs too, and that helper deliberately hides them. */
  const packs = ready
    ? await query<{
        id: string; title: string; slug: string; price: string;
        is_active: number; course_count: number; separate_total: string | null;
      }>(
        `SELECT p.id, p.title, p.slug, p.price, p.is_active,
                (SELECT COUNT(*) FROM course_pack_items i WHERE i.pack_id = p.id) AS course_count,
                (SELECT SUM(mp.price) FROM course_pack_items i2
                   JOIN (SELECT course_id, MIN(price) AS price FROM course_prices
                          WHERE is_active = 1 GROUP BY course_id) mp ON mp.course_id = i2.course_id
                  WHERE i2.pack_id = p.id) AS separate_total
           FROM course_packs p
          WHERE p.deleted_at IS NULL
          ORDER BY p.created_at DESC`
      )
    : [];

  /* The plans, when 18-pack-plans.sql has been run. Read separately and
     guarded so the page still works before the migration. */
  const hasPlans = ready && (await tablesExist(["course_pack_prices"]));
  const planRows = hasPlans
    ? await query<{ pack_id: string; plan_type: string; price: string; duration_days: number | null }>(
        `SELECT pack_id, plan_type, price, duration_days FROM course_pack_prices`
      )
    : [];
  /* The courses inside each pack, with their weight — for the split
     editor below. Empty before migration 22. */
  const hasWeights = ready && (await columnExists("course_pack_items", "revenue_weight"));
  const itemRows = ready
    ? await query<{ pack_id: string; course_id: string; title: string; weight: string | null; price: string | null }>(
        `SELECT i.pack_id, i.course_id, c.title,
                ${hasWeights ? "i.revenue_weight" : "NULL"} AS weight,
                c.min_price AS price
           FROM course_pack_items i
           JOIN courses c ON c.id = i.course_id
          ORDER BY i.sort_order`
      )
    : [];

  const planFor = (packId: string, slot: string) =>
    planRows.find((r) => r.pack_id === packId && r.plan_type === slot) ?? null;

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {!ready && (
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px] text-text-primary-light">
          {t.notInstalled}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">{t.existing}</h2>

          {packs.length === 0 ? (
            <div className="rounded-xl border border-border-light bg-white px-lg py-12 text-center">
              <Layers size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] text-text-secondary-light">{t.none}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {packs.map((p) => {
                const separate = p.separate_total === null ? 0 : Number(p.separate_total);
                const saving = Math.max(0, Math.round(separate - Number(p.price)));
                return (
                  <li key={p.id} className="rounded-xl border border-border-light bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-[15px] font-semibold text-text-primary-light">{p.title}</h3>
                      <span
                        className={
                          p.is_active === 1
                            ? "rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success"
                            : "rounded-full bg-bg-light px-2.5 py-0.5 text-[11px] font-semibold text-text-muted-light"
                        }
                      >
                        {p.is_active === 1 ? t.active : t.inactive}
                      </span>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-secondary-light">
                      <span className="num font-semibold text-text-primary-light">
                        {Number(p.price).toLocaleString("en-US")} {dict.search.currency}
                      </span>
                      <span className="num">
                        {p.course_count} {dict.packs.coursesIn}
                      </span>
                      {saving > 0 && (
                        <span className="num text-success">
                          {t.saving}: {saving.toLocaleString("en-US")}
                        </span>
                      )}
                    </p>
                    <div className="mt-2.5">
                      <TogglePack packId={p.id} isActive={p.is_active === 1} />
                    </div>

                    {/* Price and duration per plan, exactly as a course
                        is priced. */}
                    {hasPlans && (
                      <details className="mt-3 border-t border-border-light pt-3">
                        <summary className="cursor-pointer text-[13px] font-semibold text-primary">
                          {t.pricingTitle}
                        </summary>
                        <div className="mt-3">
                          <PackPricingForm
                            packId={p.id}
                            planAPrice={
                              planFor(p.id, "three_months")
                                ? Number(planFor(p.id, "three_months")!.price)
                                : null
                            }
                            planADays={planFor(p.id, "three_months")?.duration_days ?? null}
                            planBPrice={
                              planFor(p.id, "lifetime")
                                ? Number(planFor(p.id, "lifetime")!.price)
                                : Number(p.price)
                            }
                            planBDays={planFor(p.id, "lifetime")?.duration_days ?? null}
                          />
                        </div>
                      </details>
                    )}

                    {/* How this pack's income is divided between its
                        courses — they are not equal. */}
                    {hasWeights && (
                      <details className="mt-2 border-t border-border-light pt-3">
                        <summary className="cursor-pointer text-[13px] font-semibold text-primary">
                          اقتسام الدخل بين الدورات
                        </summary>
                        <div className="mt-3">
                          <PackWeightsForm
                            packId={p.id}
                            items={itemRows
                              .filter((i) => i.pack_id === p.id)
                              .map((i) => ({
                                courseId: i.course_id,
                                title: i.title,
                                weight: i.weight === null ? null : Number(i.weight),
                                price: Number(i.price ?? 0),
                              }))}
                          />
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-4 text-[15px] font-semibold text-text-primary-light">{t.create}</h2>
          <PackForm courses={courses.map((c) => ({ id: c.id, title: c.title, price: c.price === null ? null : Number(c.price) }))} />
        </aside>
      </div>
    </div>
  );
}
