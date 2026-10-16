"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Split out as a client component purely so the sidebar itself can stay
 * a server component: only the active-state check needs the pathname.
 *
 * Several nav entries are in-page anchors (/dashboard#progress), so the
 * hash is stripped before comparing — usePathname() never includes it,
 * and a raw startsWith() against "/dashboard#progress" would match
 * nothing. Anchors therefore mark /dashboard active, which is correct:
 * that IS the page they scroll within.
 */
export function StudentNavLink({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const [path, hash] = href.split("#");

  // In-page anchors are never marked active. They all share the
  // /dashboard path, so treating them as routes lit every one of them at
  // once — the nav claimed the student was on six pages simultaneously.
  // Highlighting the true anchor would need scroll-spy; until that
  // exists, only real routes get the active treatment.
  const active = hash
    ? false
    : path === "/dashboard"
      ? pathname === path
      : pathname.startsWith(path);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors",
        active
          ? "bg-primary text-white shadow-[0_6px_18px_-6px_rgba(108,76,241,0.8)]"
          : "text-white/65 hover:bg-white/[0.07] hover:text-white"
      )}
    >
      <span className="shrink-0" aria-hidden="true">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="num rounded-full bg-error px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
