"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * The official TIBYAN wordmark (adopted by the team) — a single
 * transparent-background PNG that already reads correctly on both dark
 * and light surfaces on its own (purple gradient calligraphy), so no
 * separate light/dark asset variants are needed. `tone` is kept in the
 * API purely for backward compatibility with existing call sites
 * (Navbar, Footer, AdminSidebar, MobileNav, login page, etc.) — it no
 * longer changes anything visually since the wordmark itself carries
 * its own color, but removing the prop would mean touching every
 * caller for no real benefit.
 *
 * `"use client"` so the wordmark can name itself in the reader's
 * language: its link is the site's home link, and the label said
 * "الصفحة الرئيسية" to an English screen-reader user. It is already
 * pulled into the client bundle by MobileNav, so this costs nothing.
 */
export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  void tone;
  const { t } = useI18n();

  return (
    <Link
      href="/"
      className={cn("flex items-center", className)}
      aria-label={`${t.meta.brand} — ${t.nav.home}`}
    >
      <Image
        src="/logo.png"
        alt={t.meta.brand}
        width={800}
        height={420}
        priority
        className="h-9 w-auto"
      />
    </Link>
  );
}
