"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import * as tus from "tus-js-client";
import { createAndAttachVideoAction, type CreateVideoState } from "@/lib/admin/actions/videos";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * The video file itself is never sent to our Next.js server or Vercel —
 * `createAndAttachVideoAction` only returns short-lived, scoped upload
 * credentials (a signature + expiry, not the Bunny API key), and this
 * component uses them to upload directly from the browser to Bunny's
 * TUS endpoint via `tus-js-client`. See lib/video/VideoService.ts and
 * DESIGN_SYSTEM.md's "no unnecessary heavy dependency" note — tus-js-client
 * is the one justified exception, since resumable large-file upload
 * genuinely needs it.
 */
export function VideoUploadForm({
  lessonId,
  courseId,
  defaultTitle,
}: {
  lessonId: string;
  courseId: string;
  defaultTitle: string;
}) {
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    const title = titleRef.current?.value.trim();

    if (!file) return setErrorMsg("الرجاء اختيار ملف فيديو");
    if (!title) return setErrorMsg("الرجاء إدخال عنوان الفيديو");

    setErrorMsg(null);
    setPhase("creating");

    const formData = new FormData();
    formData.set("title", title);

    const initialState: CreateVideoState = { error: null };
    const result = await createAndAttachVideoAction(lessonId, courseId, initialState, formData);

    if (result.error || !result.ticket) {
      setErrorMsg(result.error ?? "تعذّر بدء الرفع");
      setPhase("error");
      return;
    }

    setPhase("uploading");
    const { ticket } = result;

    const upload = new tus.Upload(file, {
      endpoint: ticket.uploadEndpoint,
      retryDelays: [0, 3000, 5000, 10000],
      headers: ticket.headers,
      metadata: { filetype: file.type },
      onError: (err) => {
        setErrorMsg("فشل الرفع: " + err.message);
        setPhase("error");
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => {
        setPhase("done");
      },
    });

    upload.start();
  }

  if (phase === "done") {
    return (
      <p className="rounded-md border border-success/30 bg-success/5 p-3 text-[13.5px] text-success">
        اكتمل الرفع — الفيديو الآن قيد المعالجة على Bunny Stream. اضغط على
        &quot;تحديث الحالة&quot; بعد قليل للتحقق من جاهزيته.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-dashed border-border-light p-4">
      {errorMsg && (
        <div className="mb-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[13px] text-error">
          {errorMsg}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          ref={titleRef}
          id={`video-title-${lessonId}`}
          name="title"
          label="عنوان الفيديو"
          defaultValue={defaultTitle}
          disabled={phase !== "idle" && phase !== "error"}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13.5px] font-semibold">ملف الفيديو</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            disabled={phase === "creating" || phase === "uploading"}
            className="rounded-sm border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px]"
          />
        </div>
      </div>

      {phase === "uploading" && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-border-light">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="num mt-1 block text-[12px] text-text-muted-light">{progress}%</span>
        </div>
      )}

      <Button
        type="submit"
        size="sm"
        className="mt-3"
        disabled={phase === "creating" || phase === "uploading"}
      >
        <Upload size={14} />
        {phase === "creating" ? "جارٍ التحضير..." : phase === "uploading" ? "جارٍ الرفع..." : "رفع الفيديو"}
      </Button>
    </form>
  );
}
