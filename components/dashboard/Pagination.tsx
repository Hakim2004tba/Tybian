import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pure Link-based pagination — no "use client", no JS shipped for this
 * control. Each page is its own URL (?param=N), so pages are cacheable
 * and back/forward navigation works for free. Matches the "don't send
 * unnecessary data to the client" and "keep it fast" requirements: the
 * only thing that changes per page is the small slice of data the
 * server already scoped the query to.
 *
 * `currentParams` must be passed in from the page's own resolved
 * `searchParams` — this control changes only its own `paramName` while
 * preserving every other section's page param, since /dashboard has
 * several independent paginated sections sharing one URL.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  paramName,
  basePath,
  currentParams,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  paramName: string;
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams)) {
      if (value) params.set(key, value);
    }
    params.set(paramName, String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="mt-4 flex items-center justify-center gap-1.5">
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="السابق">
        <ChevronRight size={14} />
      </PageLink>
      <span className="num px-2 text-[12.5px] text-text-muted-light">
        {page} / {totalPages}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} label="التالي">
        <ChevronLeft size={14} />
      </PageLink>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted-light/40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-text-secondary-light transition-colors hover:bg-primary/10 hover:text-primary"
      )}
    >
      {children}
    </Link>
  );
}
