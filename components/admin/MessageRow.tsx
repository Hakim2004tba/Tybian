"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MailOpen, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { updateMessageStatusAction } from "@/lib/admin/actions/messages";
import type { ContactMessageRow } from "@/lib/data/admin-messages";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const statusConfig: Record<string, { label: string; variant: "violet" | "muted" | "success" }> = {
  new: { label: "جديدة", variant: "violet" },
  read: { label: "مقروءة", variant: "muted" },
  replied: { label: "تم الرد", variant: "success" },
};

export function MessageRow({ message }: { message: ContactMessageRow }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const status = statusConfig[message.status] ?? statusConfig.new;

  function setStatus(next: "read" | "replied") {
    startTransition(async () => {
      await updateMessageStatusAction(message.id, next);
      router.refresh();
    });
  }

  return (
    <Card className={pending ? "opacity-60" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{message.name}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="num mt-0.5 text-[12.5px] text-text-muted-light">{message.email}</div>
          {message.subject && <div className="mt-1 text-[13.5px] font-medium">{message.subject}</div>}
        </div>
        <span className="num text-[11.5px] text-text-muted-light">{dateFormatter.format(new Date(message.created_at))}</span>
      </div>

      <p className="mt-3 whitespace-pre-line text-[13.5px] text-text-secondary-light">{message.body}</p>

      <div className="mt-3 flex gap-3">
        <a href={`mailto:${message.email}`} className="flex items-center gap-1.5 text-[12.5px] text-primary hover:underline">
          <Mail size={13} /> الرد عبر البريد
        </a>
        {message.status === "new" && (
          <button onClick={() => setStatus("read")} disabled={pending} className="flex items-center gap-1.5 text-[12.5px] text-text-muted-light hover:text-primary">
            <MailOpen size={13} /> تحديد كمقروءة
          </button>
        )}
        {message.status !== "replied" && (
          <button onClick={() => setStatus("replied")} disabled={pending} className="flex items-center gap-1.5 text-[12.5px] text-text-muted-light hover:text-success">
            <CheckCheck size={13} /> تحديد كتم الرد
          </button>
        )}
      </div>
    </Card>
  );
}
