"use client";

import { useActionState } from "react";
import { Youtube } from "lucide-react";
import { attachYoutubeVideoAction } from "@/lib/admin/actions/videos";
import type { ActionState } from "@/lib/admin/actions/videos";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * For content already public on YouTube — no upload happens here at
 * all. The server verifies the video actually exists (via YouTube's
 * oEmbed endpoint) before attaching it; see attachYoutubeVideoAction.
 */
export function AttachYoutubeVideoForm({
  lessonId,
  courseId,
  defaultTitle,
}: {
  lessonId: string;
  courseId: string;
  defaultTitle: string;
}) {
  const boundAction = attachYoutubeVideoAction.bind(null, lessonId, courseId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, { error: null });

  return (
    <form action={formAction} className="rounded-md border border-dashed border-border-light p-4">
      {state.error && (
        <p className="mb-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
          {state.error}
        </p>
      )}
      <p className="mb-3 text-[12.5px] text-text-muted-light">
        الصق رابط الفيديو من يوتيوب (أو معرّفه فقط). العنوان والصورة المصغّرة تُجلَبان تلقائياً.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          id={`yt-url-${lessonId}`}
          name="youtubeUrlOrId"
          label="رابط/معرّف فيديو يوتيوب"
          className="sm:col-span-2"
          required
        />
        <Input id={`yt-duration-${lessonId}`} name="durationMinutes" type="number" min={0} label="المدة (دقائق، اختياري)" />
      </div>
      <Input id={`yt-title-${lessonId}`} name="title" label="عنوان مخصص (اختياري)" defaultValue={defaultTitle} className="mt-3" />
      <SubmitButton size="sm" className="mt-3" disabled={pending}>
        <Youtube size={14} />
        {pending ? "جارٍ التحقق..." : "ربط الفيديو"}
      </SubmitButton>
    </form>
  );
}
