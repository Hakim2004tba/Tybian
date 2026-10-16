"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/layout/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/route-access";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

function dashboardPathFor(role: AppRole | null): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/dashboard";
}

/**
 * Global public navbar. Nav hrefs stay fixed (this app uses a single,
 * non-locale-prefixed route tree — see lib/i18n/dictionaries.ts for
 * why); only the LABELS switch with `dict`.
 *
 * `isAuthenticated`/`role` are passed down from the root layout, which
 * reads them from the verified Supabase session server-side (see
 * lib/auth/session.ts) — never trust a client-only auth flag for
 * anything security-relevant; this prop only controls what link/label
 * renders, the actual route protection lives in middleware.ts + RLS.
 */
export function Navbar({
  isAuthenticated = false,
  role = null,
  locale,
  dict,
}: {
  isAuthenticated?: boolean;
  role?: AppRole | null;
  locale: Locale;
  dict: Dictionary;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  /*
    The homepage hero is a full-bleed artwork, so the bar floats ON it
    rather than sitting in a grey strip above it (the reference the
    owner gave). Everywhere else the page starts with ordinary content,
    where a see-through bar would leave the links unreadable the moment
    they crossed a card — so those pages keep the solid bar and get a
    spacer standing in for the now-fixed header.
  */
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  // Transparent only while the hero is actually behind the bar.
  const transparent = overlay && !scrolled && !mobileOpen;

  const navItems = [
    { href: "/", label: dict.nav.home },
    { href: "/courses", label: dict.nav.courses },
    { href: "/about", label: dict.nav.about },
    { href: "/articles", label: dict.nav.articles },
    { href: "/contact", label: dict.nav.contact },
  ];

  return (
    <>
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-border-dark bg-bg-dark/75 backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex max-w-content items-center justify-between px-md py-[18px] md:px-xl">
        <Logo tone="dark" />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 text-[15px] text-text-secondary-dark md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-1 transition-colors hover:text-text-primary-dark",
                  active && "text-text-primary-dark"
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[19px] h-[2px] rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {/* flex, not block — see the note in StudentTopbar. */}
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle compact />
            <LanguageSwitcher currentLocale={locale} />
          </div>

          <button
            aria-label={dict.nav.search}
            className="hidden h-9 w-9 items-center justify-center rounded-md text-text-secondary-dark transition-colors hover:bg-primary/10 hover:text-text-primary-dark md:flex"
          >
            <Search size={18} />
          </button>

          <Link
            href={isAuthenticated ? dashboardPathFor(role) : "/login"}
            className="hidden items-center gap-2 rounded-md px-3 py-2 text-[14px] text-text-secondary-dark transition-colors hover:bg-primary/10 hover:text-text-primary-dark md:flex"
          >
            <User size={16} />
            {isAuthenticated ? dict.nav.account : dict.nav.login}
          </Link>

          {/* Signed-out visitors get "register"; signed-in ones get a way
              out. Sign-out previously existed only on /student/profile,
              which meant a logged-in teacher or admin had no reachable
              way to end their session at all. */}
          {isAuthenticated ? (
            <div className="hidden md:block">
              <SignOutButton />
            </div>
          ) : (
            <Link href="/register" className="hidden md:block">
              <Button variant="primary" size="sm" className="shadow-[0_4px_16px_rgba(108,76,241,0.35)]">
                {dict.nav.register}
              </Button>
            </Link>
          )}

          {/* Mobile trigger */}
          <button
            aria-label={locale === "ar" ? "فتح القائمة" : "Open menu"}
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-primary-dark md:hidden"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isAuthenticated={isAuthenticated}
        locale={locale}
        dict={dict}
      />
    </header>
    {/* The header no longer occupies space, so every page except the
        homepage needs its height back. */}
    {!overlay && <div aria-hidden className="h-[77px]" />}
    </>
  );
}
