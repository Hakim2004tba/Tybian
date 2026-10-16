"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, Search, Menu, X, ChevronDown } from "lucide-react";
import { STUDENT_NAV } from "@/components/dashboard/nav-items";
import { teacherNav } from "@/config/teacher-navigation";
import { StudentNavLink } from "@/components/dashboard/StudentNavLink";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { NotificationBell, type BellItem } from "@/components/dashboard/NotificationBell";

/**
 * The dashboard's own header — deliberately NOT the marketing Navbar.
 * It sits on the lavender content column, so it is styled light, and it
 * carries the mobile drawer for STUDENT_NAV (the sidebar is lg-only).
 *
 * Search submits to /courses, the real catalogue search, rather than
 * being a decorative input that does nothing.
 */
export function StudentTopbar({
  name,
  role,
  unreadCount = 0,
  bellItems = [],
  avatarUrl = null,
  variant = "student",
  searchAction = "/dashboard/explore",
  notificationsHref = "/dashboard/notifications",
}: {
  name: string;
  role: string;
  unreadCount?: number;
  /** The few newest, for the dropdown. Fetched with the count. */
  bellItems?: BellItem[];
  avatarUrl?: string | null;
  /*
    A STRING, not the nav array itself.

    This is a Client Component, and every entry in those arrays carries
    an `icon` that is a React component — a function. Functions cannot
    be serialised across the server/client boundary, so passing the
    list as a prop throws before anything renders. The sidebar can take
    the array because it is a Server Component; this one cannot.

    So the variant crosses the boundary and the list is imported here,
    inside the client bundle, where the functions already live.
  */
  variant?: "student" | "teacher";
  searchAction?: string;
  notificationsHref?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useI18n();

  const items = variant === "teacher" ? teacherNav : STUDENT_NAV;
  const labels: Record<string, string> =
    variant === "teacher"
      ? (t.teacher.nav as Record<string, string>)
      : (t.dash.nav as Record<string, string>);
  const label = (key: string) => labels[key] ?? key;
  const initials = name.trim().charAt(0) || t.dash.common.studentInitial;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-academy-lavender-deep/60 bg-academy-lavender/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-md py-3 md:px-xl">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.dash.common.openMenu}
            /*
              text-text-primary-light, not text-academy-deep.
              academy.deep is a dark purple that flips to near-black in
              dark mode — on a bar that is also near-black, which is how
              the menu button disappeared. The text token inverts with
              the theme; the brand colour does not.
            */
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-primary-light transition-colors hover:bg-white/70 lg:hidden"
          >
            <Menu size={20} />
          </button>

          <Link href="/dashboard" className="lg:hidden">
            <Image src="/logo.png" alt={t.meta.brand} width={120} height={34} className="h-7 w-auto" />
          </Link>

          <form action={searchAction} className="relative hidden flex-1 md:block">
            <Search
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-light"
            />
            <input
              name="q"
              type="search"
              placeholder={t.dash.common.searchPlaceholder}
              className="h-10 w-full max-w-md rounded-full border border-academy-lavender-deep/70 bg-white/80 pr-9 pl-4 text-[13.5px] text-text-primary-light outline-none transition-colors placeholder:text-text-muted-light focus:border-primary focus:bg-white"
            />
          </form>

          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            {/* The dashboard hides the marketing navbar, which is where
                the only language switcher used to live — so a signed-in
                student had no way to change language. */}
            {/*
              flex, not block. A block wrapper stacked the two controls
              vertically, which pushed the theme button up out of the bar
              and left it floating above the language pill.
            */}
            <div className="hidden items-center gap-2 sm:flex">
              <ThemeToggle compact />
              <LanguageSwitcher />
            </div>

            <NotificationBell
              items={bellItems}
              unreadCount={unreadCount}
              allHref={notificationsHref}
            />

            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2.5 rounded-full py-1 pl-2 pr-1 transition-colors hover:bg-white/70"
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-academy-deep text-[14px] font-semibold text-white">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials
                )}
              </span>
              <span className="hidden text-right sm:block">
                <span className="block text-[13px] font-semibold leading-tight text-text-primary-light">{name}</span>
                <span className="block text-[11.5px] leading-tight text-text-muted-light">{role}</span>
              </span>
              <ChevronDown size={15} className="hidden text-text-muted-light sm:block" />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile drawer — same STUDENT_NAV list as the sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 flex w-[268px] max-w-[85vw] flex-col bg-academy-deep">
            <div className="flex items-center justify-between px-lg py-lg">
              <Image src="/logo.png" alt={t.meta.brand} width={130} height={36} className="h-7 w-auto" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.dash.common.closeMenu}
                className="flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <nav
              className="flex flex-1 flex-col gap-1 overflow-y-auto px-3"
              onClick={() => setMenuOpen(false)}
            >
              {items.map((item) => (
                <StudentNavLink
                  key={item.href}
                  href={item.href}
                  label={label(item.key)}
                  icon={<item.icon size={18} strokeWidth={1.75} />}
                />
              ))}
            </nav>
            <div className="flex flex-col gap-3 border-t border-white/10 p-3">
              {/* The topbar's own switcher is hidden below sm, so the
                  phone reaches it here instead of not at all. */}
              <div className="flex items-center justify-center gap-2 sm:hidden">
                <ThemeToggle compact />
                <LanguageSwitcher />
              </div>
              <SignOutButton fullWidth />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
