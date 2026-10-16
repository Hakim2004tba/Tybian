"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();

  return (
    <button
      onClick={() =>
        startTransition(() => {
          markNotificationReadAction(notificationId);
        })
      }
      disabled={pending}
      className="shrink-0 text-text-muted-light hover:text-primary disabled:opacity-40"
      aria-label={t.dash.notifications.markRead}
      title={t.dash.notifications.markRead}
    >
      <Check size={14} />
    </button>
  );
}
