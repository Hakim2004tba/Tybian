import Image from "next/image";
import { Settings, type LucideIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { StudentNavLink } from "@/components/dashboard/StudentNavLink";
import { STUDENT_NAV } from "@/components/dashboard/nav-items";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The dark half of the dashboard's two-tone composition: this rail is
 * academy.deep, the content beside it is academy.lavender. Keeping the
 * pair at roughly a 1:4 width ratio is what stops the page reading as
 * "a dark app" — the brief calls for a balanced dark/light split, not a
 * dark page with light accents.
 *
 * Rendered by StudentShell on lg+ only; the drawer inside StudentTopbar
 * carries the same STUDENT_NAV list on smaller screens, so the two can
 * never drift apart.
 *
 * SCROLLING: the rail is one scroll container, not three stacked boxes
 * with the nav scrolling inside them. The earlier arrangement gave the
 * nav `flex-1 overflow-y-auto` and pinned the progress card and the
 * sign-out block beneath it — so once the list grew past the viewport
 * (articles and contact took it to nine entries) a grey scrollbar ran
 * down the middle of the dark rail and the card sat hard against the
 * last link. Now everything scrolls together, the bar is not drawn (see
 * .scrollbar-none), and `mt-auto` keeps the footer at the bottom
 * whenever there IS room.
 */
export async function StudentSidebar({
  name,
  unreadCount = 0,
  unreadMessages = 0,
  overallProgressPct,
  items = STUDENT_NAV,
  labels,
  settingsHref = "/dashboard/profile",
  footerCard,
}: {
  name: string;
  unreadCount?: number;
  /** Conversations with something unread — the +1 on "الرسائل". */
  unreadMessages?: number;
  overallProgressPct: number;
  /*
    The rail is shared with the teacher space, which asked for the
    student design exactly — so the frame is one component and only the
    contents differ. Duplicating it would have meant two rails drifting
    apart the first time either was touched.
  */
  items?: readonly { href: string; key: string; icon: LucideIcon }[];
  /** key → label. Defaults to the student dictionary section. */
  labels?: Record<string, string>;
  settingsHref?: string;
  /** Replaces the progress card above the footer. */
  footerCard?: React.ReactNode;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const label = (key: string) =>
    labels?.[key] ?? (t.nav as Record<string, string>)[key] ?? key;
  return (
    <aside className="scrollbar-none sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col overflow-y-auto bg-academy-deep lg:flex">
      <div className="flex items-center gap-2.5 px-lg py-lg">
        <Image src="/logo.png" alt={dict.meta.brand} width={140} height={40} className="h-8 w-auto" />
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {items.map((item) => (
          <StudentNavLink
            key={item.href}
            href={item.href}
            label={label(item.key)}
            icon={<item.icon size={18} strokeWidth={1.75} />}
            badge={
              item.key === "messages"
                ? unreadMessages
                : item.key === "notifications"
                  ? unreadCount
                  : undefined
            }
          />
        ))}
      </nav>

      {/* Motivation + progress card. Shows the student's REAL average
          progress rather than a decorative bar — a fake number here
          would undermine the one place they look for reassurance. */}
      <div className="mt-auto px-3 pb-3 pt-4">
        {footerCard ?? (
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/25 blur-2xl"
            aria-hidden="true"
          />
          <p className="relative text-[12.5px] leading-relaxed text-white/70">
            {t.sidebar.everyStep}
            <span className="block font-semibold text-white">{t.sidebar.bringsYouCloser}</span>
          </p>
          <div className="relative mt-3 flex items-center justify-between text-[11.5px] text-white/60">
            <span>{t.sidebar.overallProgress}</span>
            <span className="num font-semibold text-white">{overallProgressPct}%</span>
          </div>
          <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-primary to-secondary"
              style={{ width: `${Math.min(100, Math.max(0, overallProgressPct))}%` }}
            />
          </div>
        </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <StudentNavLink href={settingsHref} label={t.common.settings} icon={<Settings size={18} strokeWidth={1.75} />} />
        <div className="mt-1 px-1">
          <SignOutButton fullWidth onDark />
        </div>
        <p className="mt-2 truncate px-3 text-[11px] text-white/40">{name}</p>
      </div>
    </aside>
  );
}
