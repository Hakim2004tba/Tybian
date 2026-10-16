"use client";

import { useActionState } from "react";
import { Video } from "lucide-react";
import { attachVimeoVideoAction } from "@/lib/admin/actions/videos";
import type { ActionState } from "@/lib/admin/actions/videos";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * For a video the admin has already uploaded to Vimeo — no upload
 * happens through the platform. The server confirms the video exists
 * and is embeddable via Vimeo's public oEmbed endpoint, and pulls the
 * real title, thumbnail and duration from it; see
 * attachVimeoVideoAction.
 *
 * The hint about pasting the FULL link is load-bearing rather than
 * decorative: an unlisted Vimeo video only plays when its privacy hash
 * (the second path segment) travels with the ID, and pasting a
 * truncated link is the most common way to end up with a dead player.
 */
export function AttachVimeoVideoForm({
  lessonId,
  courseId,
  defaultTitle,
}: {
  lessonId: string;
  courseId: string;
  defaultTitle: string;
}) {
  const boundAction = attachVimeoVideoAction.bind(null, lessonId, courseId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, { error: null });

  return (
    <form action={formAction} className="rounded-md border border-dashed border-border-light p-4">
      {state.error && (
        <p className="mb-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
          {state.error}
        </p>
      )}
      <p className="mb-3 text-[12.5px] text-text-muted-light">
        الصق رابط الفيديو من Vimeo. العنوان والصورة المصغّرة والمدة تُجلَب تلقائياً.
      </p>
      <p className="mb-3 rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-text-secondary-light">
        إن كان الفيديو غير مُدرج (unlisted) فانسخ الرابط <strong>كاملاً بالرمز الخاص</strong> — مثل{" "}
        <code className="font-mono">vimeo.com/123456789/abcdef1234</code>. بدون هذا الرمز لن يعمل المشغّل.
      </p>
      <Input
        id={`vimeo-url-${lessonId}`}
        name="vimeoUrlOrId"
        label="رابط الفيديو من Vimeo"
        placeholder="https://vimeo.com/123456789/abcdef1234"
        required
      />
      <Input
        id={`vimeo-title-${lessonId}`}
        name="title"
        label="عنوان مخصص (اختياري)"
        defaultValue={defaultTitle}
        className="mt-3"
      />
      <SubmitButton size="sm" className="mt-3" disabled={pending}>
        <Video size={14} />
        {pending ? "جارٍ التحقق..." : "ربط الفيديو"}
      </SubmitButton>
    </form>
  );
}
