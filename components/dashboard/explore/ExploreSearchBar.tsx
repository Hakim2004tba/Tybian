"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The phone search row: a field and a filter button beside it.
 *
 * The desktop filter panel is a 260px column; on a phone it would push
 * the courses below the fold. Here it collapses behind the button and
 * opens in place, so the first thing on screen stays the courses.
 */
export function ExploreSearchBar({
  subjects,
  children,
}: {
  subjects: string[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const q = params.get("q") ?? "";
  const activeSubject = params.get("subject") ?? "";

  function apply(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    /*
      Any filter change resets paging. Without this, narrowing a search
      while on page 3 lands on a page that no longer exists and the
      student sees an empty list they cannot explain.
    */
    sp.delete("page");
    router.push(`/dashboard/explore?${sp.toString()}`);
  }

  return (
    <div className="lg:hidden">
      <form
        action="/dashboard/explore"
        className="flex items-center gap-2"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-academy-lavender-deep/70 bg-white px-4 py-2.5">
          <Search size={15} className="shrink-0 text-text-muted-light" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.search.placeholder}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text-primary-light outline-none placeholder:text-text-muted-light"
          />
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t.search.apply}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
            open
              ? "border-primary bg-primary text-white"
              : "border-academy-lavender-deep/70 bg-white text-text-secondary-light"
          )}
        >
          {open ? <X size={16} /> : <SlidersHorizontal size={16} />}
        </button>
      </form>

      {/* Subject chips — the mockup's quick filter, above the results. */}
      {subjects.length > 0 && (
        <div className="-mx-md mt-3 flex gap-2 overflow-x-auto px-md pb-1">
          <button
            type="button"
            onClick={() => apply({ subject: null })}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
              !activeSubject
                ? "bg-primary text-white"
                : "border border-academy-lavender-deep/70 bg-white text-text-secondary-light"
            )}
          >
            {t.search.allSubjects}
          </button>
          {subjects.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => apply({ subject: s })}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                activeSubject === s
                  ? "bg-primary text-white"
                  : "border border-academy-lavender-deep/70 bg-white text-text-secondary-light"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
