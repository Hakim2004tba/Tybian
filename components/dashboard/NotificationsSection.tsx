import Link from "next/link";
import {
  Award, Bell, BookOpen, ChevronLeft, Clock, CreditCard, Megaphone,
  MessageSquare, Radio,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/auth/session";
import { getNotificationsPage } from "@/lib/data/student-dashboard";
import { Pagination } from "@/components/dashboard/Pagination";
import { MarkReadButton } from "@/components/dashboard/MarkReadButton";
import { getDictionary } from "@/lib/i18n/locale";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

/*
  A FACE PER KIND.

  Every row looked identical, so a payment, a reply and an
  announcement were three grey paragraphs and the list read as noise.
  The icon is what lets the eye skip to the one that matters.
*/
const TONES: Record<string, { icon: typeof Bell; className: string }> = {
  payment_success: { icon: CreditCard, className: "bg-success/10 text-success" },
  payment_failed: { icon: CreditCard, className: "bg-error/10 text-error" },
  enrollment_activated: { icon: BookOpen, className: "bg-primary/10 text-primary" },
  enrollment_expiring: { icon: Clock, className: "bg-gold/15 text-[#8A5A18]" },
  course_update: { icon: Radio, className: "bg-secondary/10 text-secondary" },
  comment_reply: { icon: MessageSquare, className: "bg-primary/10 text-primary" },
  question_answered: { icon: MessageSquare, className: "bg-success/10 text-success" },
  certificate_issued: { icon: Award, className: "bg-gold/15 text-[#8A5A18]" },
  system: { icon: Megaphone, className: "bg-primary/10 text-primary" },
};

export async function NotificationsSection({
  page,
  currentParams,
}: {
  page: number;
  currentParams: Record<string, string | undefined>;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const { items, totalCount, pageSize } = await getNotificationsPage(user!.id, page);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[16px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell size={17} />
          </span>
          {t.notifications.title}
        </h3>
        {totalCount > 0 && <Badge variant="violet">{totalCount}</Badge>}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-lg py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-light text-text-muted-light">
            <Bell size={20} strokeWidth={1.5} />
          </span>
          <p className="text-[13.5px] text-text-secondary-light">{t.notifications.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border-light">
          {items.map((n) => {
            /*
              WHERE THE ROW GOES.

              A notification that cannot be opened is an announcement,
              and "the admin sent you a message" with no way to answer
              it is the complaint this fixes. The destination was
              already being stored; nothing read it.
            */
            const href =
              n.related_entity_type === "thread" && n.related_entity_id
                ? "/dashboard/messages"
                : n.related_entity_type === "course" && n.related_entity_id
                  ? `/courses/${n.related_entity_id}`
                  : null;

            const tone = TONES[n.type] ?? TONES.system;
            const Icon = tone.icon;

            const inner = (
              <>
                <span
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                    tone.className +
                    (n.is_read ? " opacity-50" : "")
                  }
                >
                  <Icon size={16} />
                </span>
                <div className={`min-w-0 flex-1 ${n.is_read ? "opacity-60" : ""}`}>
                  <div className="text-[13.5px] font-medium">{n.title}</div>
                  {n.body && (
                    <div className="mt-0.5 line-clamp-2 text-[12.5px] text-text-secondary-light">
                      {n.body}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="num text-[11px] text-text-muted-light">
                      {dateFormatter.format(new Date(n.created_at))}
                    </span>
                    {href && (
                      <span className="flex items-center gap-1 text-[11.5px] font-semibold text-primary">
                        {t.notifications.open}
                        <ChevronLeft size={12} className="rtl:rotate-180" />
                      </span>
                    )}
                  </div>
                </div>
              </>
            );

            return (
              <div
                key={n.id}
                className={
                  "flex items-start gap-3 px-lg py-3.5 transition " +
                  (n.is_read ? "" : "bg-primary/[0.035]")
                }
              >
                {href ? (
                  <Link href={href} className="flex min-w-0 flex-1 items-start gap-3">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3">{inner}</div>
                )}
                {!n.is_read && <MarkReadButton notificationId={n.id} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="px-lg pb-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          /* Its own page now, so the paginator must link there and use
             the parameter that page actually reads. */
          paramName="notificationsPage"
          basePath="/dashboard/notifications"
          currentParams={currentParams}
        />
      </div>
    </Card>
  );
}
