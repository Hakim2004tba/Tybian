"use client";

import { useActionState } from "react";
import { Link2 } from "lucide-react";
import { attachExistingBunnyVideoAction } from "@/lib/admin/actions/videos";
import type { ActionState } from "@/lib/admin/actions/videos";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * The preferred video-attachment path: upload the video directly on
 * Bunny's own dashboard first (their infrastructure, no upload-speed
 * bottleneck through this platform), then paste the video's ID or any
 * Bunny URL here — the GUID is extracted automatically (see
 * lib/video/extract-bunny-id.ts) and the server verifies it actually
 * exists in the library before attaching it to this lesson.
 */
export function AttachBunnyVideoForm({
  lessonId,
  courseId,
  defaultTitle,
}: {
  lessonId: string;
  courseId: string;
  defaultTitle: string;
}) {
  const boundAction = attachExistingBunnyVideoAction.bind(null, lessonId, courseId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, { error: null });

  return (
    <form action={formAction} className="rounded-md border border-dashed border-border-light p-4">
      {state.error && (
        <p className="mb-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
          {state.error}
        </p>
      )}
      <p className="mb-3 text-[12.5px] text-text-muted-light">
        ارفع الفيديو مباشرة من لوحة تحكم Bunny Stream، ثم الصق معرّف الفيديو (GUID) أو أي رابط له هنا.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id={`bunny-id-${lessonId}`} name="bunnyVideoIdOrUrl" label="معرّف/رابط الفيديو من Bunny" required />
        <Input id={`bunny-title-${lessonId}`} name="title" label="عنوان الفيديو (اختياري)" defaultValue={defaultTitle} />
      </div>
      <SubmitButton size="sm" className="mt-3" disabled={pending}>
        <Link2 size={14} />
        {pending ? "جارٍ التحقق..." : "ربط الفيديو"}
      </SubmitButton>
    </form>
  );
}
