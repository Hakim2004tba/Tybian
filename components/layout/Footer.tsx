"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { SocialLinks } from "@/components/layout/SocialLinks";

/**
 * Compact on the lesson-watching route specifically: a student inside
 * the learn workspace doesn't need the full sitemap footer competing
 * for scroll space with the discussion/notes content — a single
 * copyright line is enough there. Every other page keeps the full
 * footer. Detected via pathname rather than a prop threaded through
 * every layout, since the root layout (where Footer lives) can't
 * otherwise know which nested route rendered.
 */
export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  const isLearnPage = pathname?.includes("/learn");

  if (isLearnPage) {
    return (
      <footer className="border-t border-border-dark bg-bg-dark py-4 text-center text-[11.5px] text-text-muted-dark">
        <span className="num">
          © 2026 {locale === "ar" ? "تبيان" : "TIBYAN"}. {dict.footer.rights}.
        </span>
      </footer>
    );
  }

  const navItems = [
    { href: "/", label: dict.nav.home },
    { href: "/courses", label: dict.nav.courses },
    { href: "/about", label: dict.nav.about },
    { href: "/articles", label: dict.nav.articles },
  ];

  const legalLinks = [
    { href: "/privacy", label: dict.footer.privacy },
    { href: "/terms", label: dict.footer.terms },
    { href: "/contact", label: dict.nav.contact },
  ];

  return (
    <footer className="border-t border-border-dark bg-bg-dark py-2xl text-text-muted-dark">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-md md:px-xl">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <Logo tone="dark" />
            <p className="mt-4 text-sm leading-relaxed">{dict.footer.tagline}</p>

            <h3 className="mb-3 mt-6 text-sm font-semibold text-text-secondary-dark">
              {dict.footer.followUs}
            </h3>
            <SocialLinks tone="dark" />
          </div>

          <div className="flex flex-wrap gap-12">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-text-secondary-dark">
                {dict.footer.quickLinks}
              </h3>
              <ul className="flex flex-col gap-2 text-sm">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-text-primary-dark">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-text-secondary-dark">
                {dict.footer.legal}
              </h3>
              <ul className="flex flex-col gap-2 text-sm">
                {legalLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-text-primary-dark">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-border-dark pt-6 text-xs md:flex-row">
          <span className="num">
            © 2026 {locale === "ar" ? "تبيان" : "TIBYAN"}. {dict.footer.rights}.
          </span>
        </div>
      </div>
    </footer>
  );
}
