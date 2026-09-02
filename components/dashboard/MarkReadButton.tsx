"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markNotificationReadAction } from "@/lib/actions/notifications";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(() => {
          markNotificationReadAction(notificationId);
        })
      }
      disabled={pending}
      className="shrink-0 text-text-muted-light hover:text-primary disabled:opacity-40"
      aria-label="تحديد كمقروء"
      title="تحديد كمقروء"
    >
      <Check size={14} />
    </button>
  );
}
