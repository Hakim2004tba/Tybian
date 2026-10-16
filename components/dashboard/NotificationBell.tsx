"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type BellItem = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
  href: string | null;
};

/**
 * The bell: a peek, not a journey.
 *
 * Clicking it used to navigate to the notifications page, which meant
 * leaving whatever you were doing to find out whether anything had
 * happened — usually nothing had. It now drops a short list in place,
 * with the full page one click further for when something has.
 *
 * The items are rendered from props the server already fetched for the
 * unread count, so opening the panel costs no request.
 */
export function NotificationBell({
  items,
  unreadCount,
  allHref,
}: {
  items: BellItem[];
  unreadCount: number;
  allHref: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Closes on an outside click and on Escape — a panel that can only
     be dismissed by its own button is a panel people get stuck in. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const time = new Intl.DateTimeFormat("ar-DZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.dash.common.notifications}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary-light transition-colors hover:bg-white/70"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 top-11 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-border-light bg-surface-light shadow-[0_20px_50px_-20px_rgba(23,15,46,0.45)] motion-safe:animate-[cardIn_200ms_cubic-bezier(0.22,1,0.36,1)]"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-border-light px-4 py-2.5">
            <span className="text-[13.5px] font-semibold text-text-primary-light">
              {t.dash.notifications.title}
            </span>
            {unreadCount > 0 && (
              <span className="num rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {unreadCount}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-text-muted-light">
              {t.dash.notifications.empty}
            </p>
          ) : (
            <ul className="max-h-[22rem] divide-y divide-border-light overflow-y-auto">
              {items.map((n) => {
                const row = (
                  <>
                    {!n.is_read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className={"min-w-0 flex-1 " + (n.is_read ? "opacity-60" : "")}>
                      <span className="block truncate text-[13px] font-medium text-text-primary-light">
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block truncate text-[12px] text-text-secondary-light">
                          {n.body}
                        </span>
                      )}
                      <span className="num mt-0.5 block text-[10.5px] text-text-muted-light">
                        {time.format(new Date(n.created_at))}
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 px-4 py-2.5 transition hover:bg-black/[0.03]"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2.5 px-4 py-2.5">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-border-light px-4 py-2.5 text-[12.5px] font-semibold text-primary transition hover:bg-primary/[0.05]"
          >
            {t.dash.notifications.seeAll}
            <ChevronLeft size={13} className="rtl:rotate-180" />
          </Link>
        </div>
      )}
    </div>
  );
}
