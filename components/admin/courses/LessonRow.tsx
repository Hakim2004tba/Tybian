"use client";

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2, Lock, Unlock, PlayCircle, RefreshCw, X, UploadCloud, Youtube } from "lucide-react";
import Image from "next/image";
import {
  editLessonAction,
  deleteLessonAction,
  reorderLessonAction,
  toggleLessonPreviewAction,
} from "@/lib/admin/actions/lessons";
import { detachVideoAction, deleteVideoAction, refreshOrUpdateVideoAction } from "@/lib/admin/actions/videos";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { VideoUploadForm } from "@/components/admin/courses/VideoUploadForm";
import { AttachBunnyVideoForm } from "@/components/admin/courses/AttachBunnyVideoForm";
import { AttachYoutubeVideoForm } from "@/components/admin/courses/AttachYoutubeVideoForm";
import { cn } from "@/lib/utils";

export type VideoInfo = {
  id: string;
  source: "bunny" | "youtube";
  bunny_video_id: string | null;
  youtube_video_id: string | null;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  status: string;
};

export type LessonRowData = {
  id: string;
  title: string;
  is_free_preview: boolean;
  video_id: string | null;
  videos: VideoInfo | null;
};

const videoStatusLabel: Record<string, { label: string; variant: "success" | "muted" | "error" }> = {
  ready: { label: "جاهز", variant: "success" },
  processing: { label: "قيد المعالجة", variant: "muted" },
  failed: { label: "فشل", variant: "error" },
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LessonRow({
  lesson,
  sectionId,
  courseId,
  isFirst,
  isLast,
}: {
  lesson: LessonRowData;
  sectionId: string;
  courseId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [videoPanelOpen, setVideoPanelOpen] = useState(false);
  const [attachMode, setAttachMode] = useState<"link" | "youtube" | "upload">("link");
  const [pending, startTransition] = useTransition();

  function runAction(fn: () => Promise<{ error: string | null }>) {
    startTransition(() => {
      fn().then((result) => {
        if (result?.error) window.alert(result.error);
      });
    });
  }

  function reorder(direction: "up" | "down") {
    runAction(() => reorderLessonAction(sectionId, courseId, lesson.id, direction));
  }

  function togglePreview() {
    runAction(() => toggleLessonPreviewAction(lesson.id, courseId, !lesson.is_free_preview));
  }

  function handleDelete() {
    if (!window.confirm(`حذف الدرس "${lesson.title}"؟`)) return;
    runAction(() => deleteLessonAction(lesson.id, courseId));
  }

  function handleDetachVideo() {
    if (!window.confirm("فصل الفيديو عن هذا الدرس؟ (الفيديو نفسه يبقى على Bunny)")) return;
    runAction(() => detachVideoAction(lesson.id, courseId));
  }

  function handleDeleteVideo() {
    if (!lesson.video_id) return;
    if (!window.confirm("حذف الفيديو نهائياً من Bunny Stream؟ لا يمكن التراجع.")) return;
    runAction(() => deleteVideoAction(lesson.video_id!, lesson.id, courseId));
  }

  if (editing) {
    const action = editLessonAction.bind(null, lesson.id, courseId);
    return (
      <div className="rounded-md border border-primary/30 bg-primary/[0.03] p-4">
        <AuthForm action={action}>
          <Input id="title" name="title" label="عنوان الدرس" defaultValue={lesson.title} required />
          <label className="mt-3 flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" name="isFreePreview" defaultChecked={lesson.is_free_preview} className="h-4 w-4 accent-primary" />
            معاينة مجانية (Free Preview)
          </label>
          <div className="mt-3 flex gap-2">
            <SubmitButton size="sm">حفظ</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-sm px-3 py-2 text-[13px] text-text-muted-light hover:text-text-primary-light"
            >
              إلغاء
            </button>
          </div>
        </AuthForm>
      </div>
    );
  }

  const video = lesson.videos;
  const videoStatus = video ? (videoStatusLabel[video.status] ?? { label: video.status, variant: "muted" as const }) : null;

  return (
    <div className={cn("rounded-md", pending && "opacity-60")}>
      <div className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-bg-light">
        <div className="flex flex-col">
          <button disabled={isFirst || pending} onClick={() => reorder("up")} aria-label="نقل لأعلى" className="text-text-muted-light hover:text-primary disabled:opacity-30">
            <ChevronUp size={14} />
          </button>
          <button disabled={isLast || pending} onClick={() => reorder("down")} aria-label="نقل لأسفل" className="text-text-muted-light hover:text-primary disabled:opacity-30">
            <ChevronDown size={14} />
          </button>
        </div>

        {video?.thumbnail_url ? (
          <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-sm bg-bg-light">
            <Image src={video.thumbnail_url} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <PlayCircle size={16} className="shrink-0 text-text-muted-light" />
        )}

        <button
          onClick={() => setVideoPanelOpen((v) => !v)}
          className="min-w-0 flex-1 text-start"
        >
          <div className="truncate text-[14px] font-medium">{lesson.title}</div>
          <div className="num mt-0.5 flex items-center gap-2 text-[11.5px] text-text-muted-light">
            {video ? (
              <>
                <span>{formatDuration(video.duration_seconds)}</span>
                {videoStatus && <Badge variant={videoStatus.variant} className="px-1.5 py-0.5">{videoStatus.label}</Badge>}
                {video.source === "youtube" && (
                  <Badge variant="error" className="flex items-center gap-1 px-1.5 py-0.5">
                    <Youtube size={10} /> YouTube
                  </Badge>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1 font-medium text-gold">
                <UploadCloud size={12} />
                اضغط لرفع الفيديو
              </span>
            )}
          </div>
        </button>

        <button
          onClick={togglePreview}
          disabled={pending}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12px] font-medium transition-colors",
            lesson.is_free_preview
              ? "bg-secondary/15 text-[#0f9c86] hover:bg-secondary/25"
              : "bg-text-muted-light/10 text-text-muted-light hover:bg-text-muted-light/20"
          )}
          title={lesson.is_free_preview ? "معاينة مجانية — اضغط لجعلها مقفلة" : "مقفل — اضغط لجعلها معاينة مجانية"}
        >
          {lesson.is_free_preview ? <Unlock size={13} /> : <Lock size={13} />}
          {lesson.is_free_preview ? "مجاني" : "مقفل"}
        </button>

        <button onClick={() => setEditing(true)} aria-label="تعديل" className="text-text-muted-light hover:text-primary">
          <Pencil size={15} />
        </button>
        <button onClick={handleDelete} aria-label="حذف" className="text-text-muted-light hover:text-error">
          <Trash2 size={15} />
        </button>
      </div>

      {videoPanelOpen && (
        <div className="mx-3 mb-3 rounded-md border border-border-light bg-bg-light p-3">
          {video ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                <span className="text-text-muted-light">
                  {video.source === "youtube" ? "معرّف YouTube:" : "معرّف Bunny:"}
                </span>
                <span className="num rounded-sm bg-surface-light px-2 py-1 text-[12px]">
                  {video.source === "youtube" ? video.youtube_video_id : video.bunny_video_id}
                </span>
                {videoStatus && <Badge variant={videoStatus.variant}>{videoStatus.label}</Badge>}
                {video.source === "youtube" && (
                  <Badge variant="error" className="flex items-center gap-1">
                    <Youtube size={11} /> YouTube
                  </Badge>
                )}
              </div>

              <AuthForm action={refreshOrUpdateVideoAction.bind(null, video.id, courseId)} className="flex flex-wrap items-end gap-2">
                <Input id={`vtitle-${video.id}`} name="title" label="عنوان الفيديو" defaultValue={video.title} className="max-w-xs" />
                <SubmitButton size="sm" variant="outline">
                  <RefreshCw size={13} />
                  تحديث الحالة والعنوان
                </SubmitButton>
              </AuthForm>

              <div className="flex gap-2">
                <button onClick={handleDetachVideo} className="text-[12.5px] text-text-muted-light hover:text-primary">
                  فصل الفيديو عن الدرس
                </button>
                <span className="text-text-muted-light">·</span>
                <button onClick={handleDeleteVideo} className="text-[12.5px] text-error hover:underline">
                  حذف الفيديو نهائياً
                </button>
                <span className="text-text-muted-light">·</span>
                <button onClick={() => setVideoPanelOpen(false)} className="flex items-center gap-1 text-[12.5px] text-text-muted-light">
                  <X size={12} /> إغلاق
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-1 rounded-md bg-surface-light p-1 text-[12.5px]">
                <button
                  type="button"
                  onClick={() => setAttachMode("link")}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 transition-colors",
                    attachMode === "link" ? "bg-primary text-white" : "text-text-muted-light hover:text-primary"
                  )}
                >
                  ربط من Bunny (موصى به)
                </button>
                <button
                  type="button"
                  onClick={() => setAttachMode("youtube")}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 transition-colors",
                    attachMode === "youtube" ? "bg-primary text-white" : "text-text-muted-light hover:text-primary"
                  )}
                >
                  يوتيوب
                </button>
                <button
                  type="button"
                  onClick={() => setAttachMode("upload")}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 transition-colors",
                    attachMode === "upload" ? "bg-primary text-white" : "text-text-muted-light hover:text-primary"
                  )}
                >
                  رفع مباشر من هنا
                </button>
              </div>

              {attachMode === "link" ? (
                <AttachBunnyVideoForm lessonId={lesson.id} courseId={courseId} defaultTitle={lesson.title} />
              ) : attachMode === "youtube" ? (
                <AttachYoutubeVideoForm lessonId={lesson.id} courseId={courseId} defaultTitle={lesson.title} />
              ) : (
                <VideoUploadForm lessonId={lesson.id} courseId={courseId} defaultTitle={lesson.title} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
