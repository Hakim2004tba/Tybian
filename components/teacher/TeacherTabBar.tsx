"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { LayoutDashboard, BookOpen, Users, MessageSquare, Radio } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The teacher's phone navigation — the same floating pill with a raised
 * active icon as the student's, for the same reasons written there.
 *
 * Five of the seven destinations. QCM and reviews stay in the drawer:
 * a tab bar with seven targets on a 360px screen gives each about fifty
 * pixels, below what a thumb can reliably hit, and these five are the
 * ones a teacher opens daily.
 */
const TABS = [
  { href: "/teacher", key: "home", icon: LayoutDashboard },
  { href: "/teacher/courses", key: "courses", icon: BookOpen },
  { href: "/teacher/students", key: "students", icon: Users },
  { href: "/teacher/questions", key: "questions", icon: MessageSquare },
  { href: "/teacher/meetings", key: "meetings", icon: Radio },
] as const;

export function TeacherTabBar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [knob, setKnob] = useState<{ centre: number } | null>(null);

  const activeHref =
    TABS.find((tab) => (tab.href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(tab.href)))
      ?.href ?? null;
  const ActiveIcon = TABS.find((tab) => tab.href === activeHref)?.icon ?? null;

  /* Before paint, so the circle is in place on the first frame rather
     than sliding in from the edge on every navigation. */
  useLayoutEffect(() => {
    function place() {
      const list = listRef.current;
      const item = activeHref ? itemRefs.current.get(activeHref) : null;
      if (!list || !item) {
        setKnob(null);
        return;
      }
      const listBox = list.getBoundingClientRect();
      const itemBox = item.getBoundingClientRect();
      setKnob({ centre: itemBox.left - listBox.left + itemBox.width / 2 });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("orientationchange", place);
    };
  }, [activeHref, t]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <ul
        ref={listRef}
        className="relative flex items-stretch rounded-[26px] border border-white/70 bg-white/85 px-1 shadow-[0_10px_34px_rgba(31,20,77,0.16)] backdrop-blur-xl"
      >
        {knob && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 left-0 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_22px_rgba(108,76,241,0.45)] ring-4 ring-academy-lavender transition-transform duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${knob.centre}px) translateX(-50%)` }}
          >
            {ActiveIcon && <ActiveIcon size={22} strokeWidth={2} />}
          </span>
        )}

        {TABS.map((tab) => {
          const active = tab.href === activeHref;
          const Icon = tab.icon;
          return (
            <li
              key={tab.href}
              ref={(el) => {
                if (el) itemRefs.current.set(tab.href, el);
                else itemRefs.current.delete(tab.href);
              }}
              className="relative flex-1"
            >
              <Link href={tab.href} aria-current={active ? "page" : undefined} className="group flex flex-col items-center gap-1 px-1 pb-2 pt-3">
                <span
                  className={cn(
                    "flex h-6 items-center justify-center transition-all duration-[300ms] ease-out group-active:scale-90",
                    active ? "scale-50 opacity-0" : "scale-100 text-text-muted-light opacity-100"
                  )}
                >
                  <Icon size={19} strokeWidth={1.75} />
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10.5px] leading-none transition-all duration-300",
                    active ? "font-bold text-primary" : "font-medium text-text-muted-light opacity-80"
                  )}
                >
                  {(t.teacher.nav as Record<string, string>)[tab.key] ?? tab.key}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
