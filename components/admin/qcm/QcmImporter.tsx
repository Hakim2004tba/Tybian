"use client";

import { useRef, useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { importTopicAction } from "@/lib/admin/actions/qcm-import";

type Item = {
  name: string;
  status: "waiting" | "importing" | "done" | "failed";
  note?: string;
};

/**
 * Importing a subject's question files from the browser.
 *
 * The first version of this was a terminal command that produced SQL
 * to paste into phpMyAdmin. That is a fine tool for whoever wrote it
 * and a wall for everyone else — and the person adding subjects here
 * does not use a terminal. Drop the files, watch them land.
 *
 * ONE FILE AT A TIME, in order. Eighteen files of fifty questions
 * each is not one request on shared hosting; sending them separately
 * means a failure is one topic to retry, not the whole subject, and
 * the list shows exactly where it stopped.
 */
export function QcmImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [slug, setSlug] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const ready = subject.trim().length > 0 && /^[a-z0-9-]{2,60}$/.test(slug.trim());

  async function run(fileList: FileList) {
    const files = [...fileList].filter((f) => f.name.toLowerCase().endsWith(".json"));
    if (files.length === 0) return;

    setBusy(true);
    setItems(files.map((f) => ({ name: f.name, status: "waiting" })));

    for (const [i, file] of files.entries()) {
      setItems((list) =>
        list.map((it, j) => (j === i ? { ...it, status: "importing" } : it))
      );

      try {
        const text = await file.text();
        const result = await importTopicAction(subject.trim(), slug.trim(), file.name, text);
        setItems((list) =>
          list.map((it, j) =>
            j === i
              ? result.error
                ? { ...it, status: "failed", note: result.error }
                : { ...it, status: "done", note: `${result.topic} — ${result.questions} سؤالاً` }
              : it
          )
        );
      } catch {
        setItems((list) =>
          list.map((it, j) =>
            j === i ? { ...it, status: "failed", note: "تعذّر الاستيراد" } : it
          )
        );
      }
    }

    setBusy(false);
  }

  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="rounded-2xl border border-border-light bg-white p-4 md:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-primary-light">اسم المادّة</span>
          <input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              /* The identifier follows the name unless it was typed. */
              if (!slug || slug === suggest(subject)) setSlug(suggest(e.target.value));
            }}
            placeholder="Anatomie"
            className="rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-primary-light">
            المُعرّف (في الرابط)
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="anatomie"
            className="num rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (ready && !busy && e.dataTransfer.files) void run(e.dataTransfer.files);
        }}
        onClick={() => ready && !busy && inputRef.current?.click()}
        className={
          "mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition " +
          (!ready
            ? "cursor-not-allowed border-border-light bg-bg-light opacity-60"
            : dragging
              ? "cursor-pointer border-primary bg-primary/5"
              : "cursor-pointer border-border-light bg-surface-light")
        }
      >
        <UploadCloud size={24} className="text-primary" />
        <p className="text-[13.5px] font-semibold text-text-primary-light">
          {ready ? "اسحب ملفّات JSON هنا أو اضغط للاختيار" : "اكتب اسم المادّة ومُعرّفها أولاً"}
        </p>
        <p className="text-[12px] leading-relaxed text-text-muted-light">
          ملفّ لكل محور. اخترها كلّها مرّة واحدة — تُستورَد واحداً بعد الآخر.
          إعادة استيراد نفس الملفّ تُحدّث ولا تُكرّر.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void run(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <>
          <p className="num mt-3 text-[12.5px] text-text-secondary-light">
            {done} / {items.length}
          </p>
          <ul className="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {items.map((it, i) => (
              <li
                key={`${it.name}-${i}`}
                className="flex items-start gap-2 rounded-lg border border-border-light bg-surface-light px-3 py-2 text-[12.5px]"
              >
                {it.status === "done" && (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" />
                )}
                {it.status === "failed" && (
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-error" />
                )}
                {it.status === "importing" && (
                  <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-primary" />
                )}
                {it.status === "waiting" && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-light" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-text-primary-light">{it.name}</span>
                  {it.note && (
                    <span
                      className={
                        "block text-[11.5px] " +
                        (it.status === "failed" ? "text-error" : "text-text-muted-light")
                      }
                    >
                      {it.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function suggest(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
