import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CourseSearchParams } from "@/lib/search/params";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * A plain <form method="GET" action="/courses">. Submitting it navigates
 * to a new URL like /courses?year=1&rating=4&subject=X — no client-side
 * state, no fetch-then-filter. The sort param is preserved via a hidden
 * input so changing a filter doesn't silently reset it (page
 * intentionally resets to 1 on any new filter, by simply omitting it).
 */
export async function FilterPanel({
  params,
  academicYears,
  subjects,
}: {
  params: CourseSearchParams;
  academicYears: { id: string; name_ar: string }[];
  subjects: string[];
}) {
  const { dict } = await getDictionary();
  const t = dict.search;
  return (
    <form
      method="GET"
      action="/courses"
      className="flex flex-col gap-5 rounded-lg border border-border-light bg-surface-light p-lg shadow-md"
    >
      {params.sort !== "popular" && <input type="hidden" name="sort" value={params.sort} />}

      <div className="flex items-center gap-2 rounded-sm border border-border-light bg-bg-light px-3.5 py-2.5">
        <Search size={16} className="text-text-muted-light" />
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={t.placeholder}
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-text-muted-light"
        />
      </div>

      <Field label={t.academicYear}>
        <select
          name="year"
          defaultValue={params.yearId ?? ""}
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="">{t.allYears}</option>
          {academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name_ar}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.subject}>
        <select
          name="subject"
          defaultValue={params.subject ?? ""}
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="">{t.allSubjects}</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.rating}>
        <select
          name="rating"
          defaultValue={params.ratingMin ?? ""}
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="">{t.anyRating}</option>
          <option value="4">{t.stars4}</option>
          <option value="3">{t.stars3}</option>
          <option value="2">{t.stars2}</option>
        </select>
      </Field>

      <Field label={t.duration}>
        <select
          name="duration"
          defaultValue={params.duration ?? ""}
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="">{t.anyDuration}</option>
          <option value="short">{t.under2h}</option>
          <option value="medium">{t.from2to10h}</option>
          <option value="long">{t.over10h}</option>
        </select>
      </Field>

      <Field label={t.price}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="price_min"
            min={0}
            defaultValue={params.priceMin ?? ""}
            placeholder={t.from}
            className="w-full rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
          <span className="text-text-muted-light">—</span>
          <input
            type="number"
            name="price_max"
            min={0}
            defaultValue={params.priceMax ?? ""}
            placeholder={t.to}
            className="w-full rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
        </div>
      </Field>

      <Button type="submit" className="w-full justify-center">
        {t.apply}
      </Button>
      <a href="/courses" className="text-center text-[12.5px] text-text-muted-light hover:text-primary">
        {t.resetAll}
      </a>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold">{label}</label>
      {children}
    </div>
  );
}
