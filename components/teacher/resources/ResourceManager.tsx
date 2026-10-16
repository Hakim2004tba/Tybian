"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud, Paperclip, Trash2, Pencil, ChevronUp, ChevronDown,
  CheckCircle2, AlertCircle, Loader2, X, ExternalLink,
} from "lucide-react";
import {
  renameResourceAction, deleteResourceAction, moveResourceAction,
} from "@/lib/teacher/actions/resources";

export type Resource = { id: string; title: string; sizeLabel: string | null };

/**
 * A lesson's attachments: drop files in, rename, reorder, remove.
 *
 * Uploads run ONE AT A TIME. Five 20 MB decks sent together is 100 MB
 * in flight on a shared host with a proxy that will start refusing;
 * sequentially it is slower on paper and finishes more often, and a
 * failure names the file that failed instead of leaving the teacher to
 * guess which of five did.
 *
 * XMLHttpRequest rather than fetch, for the one thing fetch still
 * cannot do: report upload progress. A 20 MB file on Algerian ADSL is
 * a minute of silence otherwise, which reads as a frozen page.
 */
export function ResourceManager({
  lessonId,
  resources,
}: {
  lessonId: string;
  resources: Resource[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [queue, setQueue] = useState<{ name: string; status: string; error?: string }[]>([]);
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setQueue(list.map((f) => ({ name: f.name, status: "waiting" })));

    for (const [index, file] of list.entries()) {
      setQueue((q) => q.map((it, i) => (i === index ? { ...it, status: "uploading" } : it)));
      setPercent(0);
      try {
        await new Promise<void>((resolve, reject) => {
          const body = new FormData();
          body.append("file", file);
          body.append("lessonId", lessonId);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/teacher/resources/upload");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setPercent(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve();
            let message = `HTTP ${xhr.status}`;
            try {
              const parsed = JSON.parse(xhr.responseText) as { error?: string };
              if (parsed.error) message = parsed.error;
            } catch {
              /* a proxy error page, not JSON — the status is the message */
            }
            reject(new Error(message));
          };
          xhr.onerror = () => reject(new Error("network"));
          xhr.send(body);
        });
        setQueue((q) => q.map((it, i) => (i === index ? { ...it, status: "done" } : it)));
      } catch (error) {
        setQueue((q) =>
          q.map((it, i) =>
            i === index
              ? { ...it, status: "failed", error: error instanceof Error ? error.message : "failed" }
              : it
          )
        );
      }
    }

    setBusy(false);
    setPercent(0);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void upload(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 text-center transition " +
          (dragging ? "border-primary bg-primary/5" : "border-border-light bg-surface-light")
        }
      >
        <UploadCloud size={22} className="text-primary" />
        <p className="text-[13.5px] font-semibold text-text-primary-light">
          اسحب المرفقات هنا أو اضغط للاختيار
        </p>
        <p className="text-[12px] leading-relaxed text-text-muted-light">
          PDF، صور، مستندات… الحدّ الأقصى 25 ميغابايت للملفّ. لا يراها إلّا
          الطالب الذي يملك حقّ مشاهدة هذا الدرس.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {queue.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border-light bg-surface-light px-3 py-2 text-[12.5px]"
            >
              {it.status === "done" && <CheckCircle2 size={14} className="shrink-0 text-success" />}
              {it.status === "failed" && <AlertCircle size={14} className="shrink-0 text-error" />}
              {it.status === "uploading" && <Loader2 size={14} className="shrink-0 animate-spin text-primary" />}
              {it.status === "waiting" && <span className="h-3.5 w-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate text-text-secondary-light">{it.name}</span>
              {it.status === "uploading" && <span className="num text-primary">{percent}%</span>}
              {it.status === "failed" && (
                <span className="num shrink-0 text-error">{errorLabel(it.error)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {resources.length === 0 ? (
        <p className="rounded-xl border border-border-light bg-surface-light px-lg py-8 text-center text-[13.5px] text-text-secondary-light">
          لا مرفقات لهذا الدرس بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resources.map((r, i) => (
            <li key={r.id} className="rounded-xl border border-border-light bg-surface-light p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Paperclip size={16} />
                </span>

                {editing === r.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    action={async (formData) => {
                      await renameResourceAction(r.id, String(formData.get("title") ?? ""));
                      setEditing(null);
                      router.refresh();
                    }}
                  >
                    <input
                      name="title"
                      defaultValue={r.title}
                      autoFocus
                      className="min-w-0 flex-1 rounded-sm border border-border-light bg-surface-light px-2.5 py-1.5 text-[13.5px] outline-none focus:border-primary"
                    />
                    <button className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white">
                      حفظ
                    </button>
                  </form>
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-text-primary-light">
                      {r.title}
                    </span>
                    {r.sizeLabel && (
                      <span className="num block text-[11.5px] text-text-muted-light">{r.sizeLabel}</span>
                    )}
                  </span>
                )}

                <RowButton label="أعلى" disabled={i === 0} onClick={() => startTransition(() => void moveResourceAction(r.id, "up"))}>
                  <ChevronUp size={14} />
                </RowButton>
                <RowButton label="أسفل" disabled={i === resources.length - 1} onClick={() => startTransition(() => void moveResourceAction(r.id, "down"))}>
                  <ChevronDown size={14} />
                </RowButton>
                <a
                  href={`/api/lessons/${lessonId}/resources/${r.id}?download=1`}
                  title="معاينة"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border-light text-text-secondary-light hover:border-primary/40 hover:text-primary"
                >
                  <ExternalLink size={13} />
                </a>
                <RowButton label={editing === r.id ? "إلغاء" : "إعادة تسمية"} onClick={() => setEditing(editing === r.id ? null : r.id)}>
                  {editing === r.id ? <X size={14} /> : <Pencil size={13} />}
                </RowButton>
                <RowButton
                  label="حذف"
                  danger
                  onClick={() => {
                    if (!window.confirm(`حذف «${r.title}»؟ سيُحذف الملفّ من القرص.`)) return;
                    startTransition(async () => {
                      await deleteResourceAction(r.id);
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 size={13} />
                </RowButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowButton({
  label, onClick, disabled, danger, children,
}: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-light transition disabled:cursor-not-allowed disabled:opacity-30 " +
        (danger
          ? "text-error hover:border-error/40 hover:bg-error/10"
          : "text-text-secondary-light hover:border-primary/40 hover:text-primary")
      }
    >
      {children}
    </button>
  );
}

/** Machine codes from the route, turned into something to act on. */
function errorLabel(code?: string): string {
  switch (code) {
    case "too_large": return "أكبر من 25 ميغابايت";
    case "not_your_lesson": return "ليس درسك";
    case "forbidden": return "غير مصرّح";
    case "empty_file": return "ملفّ فارغ";
    case "network": return "انقطع الاتّصال";
    default: return code ?? "فشل";
  }
}
