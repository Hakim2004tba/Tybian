"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const dateTimeFormatter = new Intl.DateTimeFormat("ar-DZ", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function RefreshAnalyticsButton({
  action,
  computedAt,
}: {
  action: () => Promise<{ error: string | null }>;
  computedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      {computedAt ? (
        <span className="num text-[12px] text-text-muted-light">
          آخر تحديث: {dateTimeFormatter.format(new Date(computedAt))}
        </span>
      ) : (
        <span className="text-[12px] text-gold">لم يُحسب بعد</span>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            action().then((r) => {
              if (r.error) window.alert(r.error);
            });
          })
        }
      >
        <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "جارٍ التحديث..." : "تحديث الآن"}
      </Button>
    </div>
  );
}
