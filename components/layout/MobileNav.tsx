"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

export function MobileNav({
  open,
  onClose,
  isAuthenticated = false,
  locale,
  dict,
}: {
  open: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const navItems = [
    { href: "/", label: dict.nav.home },
    { href: "/courses", label: dict.nav.courses },
    { href: "/about", label: dict.nav.about },
    { href: "/articles", label: dict.nav.articles },
    { href: "/contact", label: dict.nav.contact },
  ];

  // `document` doesn't exist during SSR — only portal once mounted client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer — opens from the reading-start edge (right in Arabic,
          left in English). Rendered via createPortal directly into
          document.body — CRITICAL, not cosmetic: the navbar's <header>
          uses `backdrop-blur-xl`, and per the CSS spec any ancestor
          with a `filter`/`backdrop-filter` becomes the containing
          block for `position: fixed` descendants (the same rule that
          applies to `transform`). Without the portal, this drawer's
          "fixed, full-height" box was actually being sized/positioned
          relative to the ~73px-tall header instead of the viewport —
          collapsing its solid background to just the header's height
          and leaving the rest of the drawer completely transparent,
          with page content showing straight through. Confirmed via a
          real headless-browser reproduction, not just static analysis:
          the drawer's computed height was literally 72px instead of
          the full viewport before this fix.
          Positioning itself uses PHYSICAL right-0/left-0 (not logical
          end-0) + a matching-sign transform, which is also correct but
          was NOT the actual cause of the bug — worth keeping regardless
          since it's more robust than mixing logical position with a
          direction-conditional transform sign. */}
      <div
        className={cn(
          "fixed inset-y-0 z-50 flex w-[82%] max-w-[340px] flex-col gap-8 bg-bg-dark p-lg transition-transform duration-200 ease-out md:hidden",
          locale === "ar" ? "right-0" : "left-0",
          open ? "translate-x-0" : locale === "ar" ? "translate-x-full" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={locale === "ar" ? "القائمة" : "Menu"}
      >
        <div className="flex items-center justify-between">
          <Logo tone="dark" />
          <button onClick={onClose} aria-label={locale === "ar" ? "إغلاق القائمة" : "Close menu"} className="text-text-secondary-dark">
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="rounded-md px-3 py-3 text-[15px] text-text-secondary-dark transition-colors hover:bg-primary/10 hover:text-text-primary-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <LanguageSwitcher currentLocale={locale} />
          <Link href={isAuthenticated ? "/dashboard" : "/login"} onClick={onClose}>
            <Button variant="outline" className="w-full justify-center border-border-dark text-text-primary-dark">
              {isAuthenticated ? dict.nav.account : dict.nav.login}
            </Button>
          </Link>
          <Link href="/register" onClick={onClose}>
            <Button variant="primary" className="w-full justify-center">
              {dict.nav.register}
            </Button>
          </Link>
        </div>
      </div>
    </>,
    document.body
  );
}
