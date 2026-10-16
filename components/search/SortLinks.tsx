import Link from "next/link";
import { SORT_OPTIONS, courseSearchParamsToQueryString, type CourseSearchParams } from "@/lib/search/params";
import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n/locale";

export async function SortLinks({ params }: { params: CourseSearchParams }) {
  const { dict } = await getDictionary();
  const t = dict.search;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="me-1 text-[13px] text-text-muted-light">{t.sortBy}</span>
      {SORT_OPTIONS.map((opt) => {
        const active = params.sort === opt.value;
        const qs = courseSearchParamsToQueryString({ ...params, sort: opt.value, page: 1 });
        return (
          <Link
            key={opt.value}
            href={`/courses${qs ? `?${qs}` : ""}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12.5px] transition-colors",
              active
                ? "bg-primary text-white"
                : "bg-bg-light text-text-secondary-light hover:bg-primary/10 hover:text-primary"
            )}
          >
            {dict.pages.sort[opt.key]}
          </Link>
        );
      })}
    </div>
  );
}
