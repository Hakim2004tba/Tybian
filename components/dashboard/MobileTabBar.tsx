"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { LayoutDashboard, FileText, BookOpen, TrendingUp, User } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The bottom tab bar — the phone's primary navigation.
 *
 * A floating pill rather than a bar welded to the bottom edge, with the
 * current tab's icon lifted out of it into a raised circle. The shape
 * is the one in the reference: the selection is not a tint behind an
 * icon, it is the icon leaving the bar.
 *
 * FIVE ITEMS, not the sidebar's nine. A tab bar with nine targets on a
 * 360px screen gives each about forty pixels — below what a thumb can
 * hit. The rest stay in the drawer and on the dashboard's own cards.
 *
 * THE RAISED CIRCLE MOVES; it is not five circles taking turns. One
 * object that travels reads as one selection changing place. Its
 * position is MEASURED from the DOM rather than computed as
 * `index * 20%`, because the labels are different widths in Arabic and
 * English and a percentage lands the circle beside the icon instead of
 * under it.
 *
 * `lg:hidden` because from lg up the sidebar is already on screen.
 */
const TABS = [
  { href: "/dashboard", key: "home", icon: LayoutDashboard },
  /*
    Course material, not "explore courses". Browsing the catalogue is
    something a student does a handful of times; the university's own
    material is what they open every day, and a tab bar is for the
    second kind. Explore stays one tap away in the sidebar and the
    drawer.
  */
  { href: "/dashboard/lessons", key: "lessons", icon: FileText },
  { href: "/dashboard/courses", key: "myCourses", icon: BookOpen },
  { href: "/dashboard/progress", key: "progress", icon: TrendingUp },
  { href: "/dashboard/profile", key: "profile", icon: User },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [knob, setKnob] = useState<{ centre: number } | null>(null);

  const activeHref =
    TABS.find((tab) =>
      tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href)
    )?.href ?? null;

  const ActiveIcon = TABS.find((tab) => tab.href === activeHref)?.icon ?? null;

  /*
    useLayoutEffect, not useEffect: this runs before paint, so the
    circle is already in place on the first frame. With useEffect it
    starts at the edge and slides across on every page load, which
    reads as a bug rather than a transition.
  */
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
    /* Rotating the phone, or switching language, changes every width. */
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("orientationchange", place);
    };
  }, [activeHref, t]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 lg:hidden"
      /*
        The home-indicator strip on modern phones sits over the bottom
        of the viewport. Without this the bar — and the tap targets with
        it — live underneath it.
      */
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <ul
        ref={listRef}
        className="relative flex items-stretch rounded-[26px] border border-white/70 bg-white/85 px-1 shadow-[0_10px_34px_rgba(31,20,77,0.16)] backdrop-blur-xl"
      >
        {/*
          The raised circle, behind the tabs. `transform` only, so the
          browser animates it on the compositor — animating `left` would
          relayout the whole bar on every frame of the slide.
        */}
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
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 px-1 pb-2 pt-3"
              >
                {/*
                  The in-bar icon fades and shrinks away as the circle
                  arrives to take its place — the same icon, handed from
                  the bar to the knob. Kept in the layout (not removed)
                  so nothing beside it shifts during the handover.
                */}
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
                    active
                      ? "font-bold text-primary"
                      : "font-medium text-text-muted-light opacity-80"
                  )}
                >
                  {t.dash.tabs[tab.key]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
