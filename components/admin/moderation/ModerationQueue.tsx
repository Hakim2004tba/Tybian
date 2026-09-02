"use client";

import { useTransition } from "react";
import { Flag, Check, X, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { resolveReportAction, deleteReportedCommentAction } from "@/lib/admin/actions/moderation";
import type { ReportRow } from "@/lib/data/admin-moderation";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const targetLabel: Record<string, string> = {
  comment: "تعليق",
  comment_reply: "رد",
  review: "تقييم",
};

export function ModerationQueue({ reports }: { reports: ReportRow[] }) {
  const [pending, startTransition] = useTransition();

  function runVoid(fn: () => Promise<{ error: string | null }>) {
    startTransition(() => {
      fn().then((r) => {
        if (r?.error) window.alert(r.error);
      });
    });
  }

  if (reports.length === 0) {
    return (
      <Card>
        <p className="text-[14px] text-text-secondary-light">لا توجد بلاغات قيد المراجعة.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reports.map((r) => (
        <Card key={r.id} className={pending ? "opacity-60" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flag size={15} className="text-error" />
              <Badge variant="violet">{targetLabel[r.target_type] ?? r.target_type}</Badge>
              <span className="text-[13px] text-text-muted-light">
                بلّغ عنه: {r.reporter?.full_name ?? "مستخدم"}
              </span>
            </div>
            <span className="num text-[11.5px] text-text-muted-light">{dateFormatter.format(new Date(r.created_at))}</span>
          </div>

          {r.reason && <p className="mt-2 text-[13px] text-text-secondary-light">سبب البلاغ: {r.reason}</p>}

          {r.commentBody && (
            <div className="mt-3 rounded-md border border-border-light bg-bg-light p-3">
              {r.commentLessonTitle && (
                <div className="mb-1 text-[11.5px] text-text-muted-light">في: {r.commentLessonTitle}</div>
              )}
              <p className="text-[13.5px]">{r.commentBody}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => runVoid(() => resolveReportAction(r.id, "dismissed"))}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[12.5px] text-text-muted-light hover:bg-text-muted-light/10"
            >
              <X size={13} /> تجاهل البلاغ
            </button>
            <button
              onClick={() => runVoid(() => resolveReportAction(r.id, "resolved"))}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[12.5px] text-success hover:bg-success/10"
            >
              <Check size={13} /> تم التعامل معه (إبقاء المحتوى)
            </button>
            {r.target_type === "comment" && (
              <button
                onClick={() => {
                  if (window.confirm("حذف هذا التعليق نهائياً؟")) {
                    runVoid(() => deleteReportedCommentAction(r.id, r.target_id));
                  }
                }}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[12.5px] text-error hover:bg-error/10"
              >
                <Trash2 size={13} /> حذف التعليق
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
