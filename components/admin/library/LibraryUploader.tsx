"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Item = {
  name: string;
  status: "waiting" | "uploading" | "done" | "failed";
  error?: string;
};

/**
 * Drops files into a folder, one request each.
 *
 * SEQUENTIAL, not parallel. Ten 30 MB PDFs sent at once is 300 MB in
 * flight on a shared host with a small memory allowance and a proxy
 * that will start refusing; one at a time is slower on paper and
 * finishes more often. It also means a failure names the file that
 * failed instead of leaving the admin guessing which of ten did.
 *
 * XMLHttpRequest rather than fetch, for the one thing fetch still
 * cannot do: report upload progress. A 40 MB file on Algerian ADSL is
 * a minute of silence otherwise, which reads as a frozen page.
 */
export function LibraryUploader({ folderId }: { folderId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setItems(list.map((f) => ({ name: f.name, status: "waiting" })));

    for (const [index, file] of list.entries()) {
      setItems((s) => s.map((it, i) => (i === index ? { ...it, status: "uploading" } : it)));
      setPercent(0);

      try {
        await new Promise<void>((resolve, reject) => {
          const body = new FormData();
          body.append("file", file);
          body.append("folderId", folderId);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/admin/library/upload");
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

        setItems((s) => s.map((it, i) => (i === index ? { ...it, status: "done" } : it)));
      } catch (error) {
        setItems((s) =>
          s.map((it, i) =>
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
    <div>
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
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition " +
          (dragging ? "border-primary bg-primary/5" : "border-border-light bg-surface-light")
        }
      >
        <UploadCloud size={24} className="text-primary" />
        <p className="text-[13.5px] font-semibold text-text-primary-light">
          اسحب الملفّات هنا أو اضغط للاختيار
        </p>
        <p className="text-[12px] leading-relaxed text-text-muted-light">
          PDF يُفتح داخل المنصّة بتظليل وبحث. الصور تُعرض. PPTX و DOCX تُنزَّل فقط —
          صدّر العرض بصيغة PDF ليقرأه الطالب هنا. الحدّ الأقصى 40 ميغابايت للملفّ.
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

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border-light bg-white px-3 py-2 text-[12.5px]"
            >
              {it.status === "done" && <CheckCircle2 size={14} className="shrink-0 text-success" />}
              {it.status === "failed" && <AlertCircle size={14} className="shrink-0 text-error" />}
              {it.status === "uploading" && (
                <Loader2 size={14} className="shrink-0 animate-spin text-primary" />
              )}
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
    </div>
  );
}

/** Turns the route's machine codes into something an admin can act on. */
function errorLabel(code?: string): string {
  switch (code) {
    case "too_large":
      return "أكبر من 40 ميغابايت";
    case "bad_folder":
      return "المجلّد غير موجود";
    case "not_installed":
      return "شغّل 09-library.sql";
    case "forbidden":
      return "غير مصرّح";
    case "empty_file":
      return "ملفّ فارغ";
    case "network":
      return "انقطع الاتّصال";
    default:
      return code ?? "فشل";
  }
}
