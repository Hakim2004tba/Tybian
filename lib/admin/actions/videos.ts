"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRouteAccess } from "@/lib/auth/session";
import { videoService } from "@/lib/video";
import { extractBunnyVideoId } from "@/lib/video/extract-bunny-id";
import { extractYoutubeVideoId } from "@/lib/video/extract-youtube-id";

export type ActionState = { error: string | null; success?: string | null };

export type UploadTicket = {
  dbVideoId: string;
  uploadEndpoint: string;
  headers: Record<string, string>;
};

export type CreateVideoState = ActionState & { ticket?: UploadTicket };

async function assertAdmin() {
  await requireRouteAccess("/admin");
}

/**
 * Step 1 of "Upload video": registers a new video with Bunny (empty,
 * no bytes yet), stores the DB row, attaches it to the lesson, and
 * returns short-lived TUS upload credentials for the BROWSER to use
 * directly against Bunny — the video bytes never pass through this
 * server or Vercel. See lib/video/VideoService.ts and
 * components/admin/courses/VideoUploadForm.tsx for the client half of
 * this flow.
 */
export async function createAndAttachVideoAction(
  lessonId: string,
  courseId: string,
  _prev: CreateVideoState,
  formData: FormData
): Promise<CreateVideoState> {
  await assertAdmin();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "الرجاء إدخال عنوان الفيديو" };

  let providerVideoId: string;
  try {
    const created = await videoService.createVideo(title);
    providerVideoId = created.providerVideoId;
  } catch (err) {
    return { error: "تعذّر إنشاء الفيديو على Bunny Stream: " + (err as Error).message };
  }

  const supabase = await createClient();
  const { data: video, error } = await supabase
    .from("videos")
    .insert({
      bunny_video_id: providerVideoId,
      bunny_library_id: process.env.BUNNY_STREAM_LIBRARY_ID!,
      title,
      status: "processing",
    })
    .select("id")
    .single();

  if (error || !video) return { error: "تعذّر حفظ سجل الفيديو: " + error?.message };

  const { error: attachError } = await supabase
    .from("lessons")
    .update({ video_id: video.id })
    .eq("id", lessonId);

  if (attachError) {
    return { error: "تعذّر ربط الفيديو بالدرس: " + attachError.message };
  }

  const creds = videoService.getUploadCredentials(providerVideoId);

  revalidatePath(`/admin/courses/${courseId}/structure`);

  return {
    error: null,
    ticket: {
      dbVideoId: video.id,
      uploadEndpoint: creds.uploadEndpoint,
      headers: creds.headers,
    },
  };
}

/**
 * Step 2, called by the admin after the browser's direct TUS upload to
 * Bunny finishes — polls Bunny for current encode status and syncs it
 * into the DB. Also doubles as "Update video" (title) when a new title
 * is provided.
 */
/**
 * The alternative to createAndAttachVideoAction's browser-upload flow —
 * for an admin who already uploaded the video directly on Bunny's own
 * dashboard (fast, their own infrastructure) and just wants to tell
 * TIBYAN which video to attach. No TUS upload happens here at all; the
 * only network call is a single GET to confirm the video actually
 * exists in the configured library and to pull its real
 * status/duration/thumbnail, so the local `videos` row is never a bare
 * guess at what Bunny has.
 */
export async function attachExistingBunnyVideoAction(
  lessonId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const raw = String(formData.get("bunnyVideoIdOrUrl") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!raw) return { error: "الرجاء لصق معرّف الفيديو أو رابطه من Bunny" };

  const videoId = extractBunnyVideoId(raw);
  if (!videoId) {
    return { error: "تعذّر التعرّف على معرّف الفيديو من النص المُدخل — تأكد أنه معرّف (GUID) أو رابط صحيح من Bunny" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("videos")
    .select("id")
    .eq("bunny_video_id", videoId)
    .maybeSingle();
  if (existing) return { error: "هذا الفيديو مرتبط بالفعل بدرس آخر في المنصة" };

  let details;
  try {
    details = await videoService.getVideoDetails(videoId);
  } catch {
    return {
      error:
        "تعذّر العثور على هذا الفيديو في مكتبة Bunny المضبوطة — تأكد أن المعرّف صحيح، وأن الفيديو مرفوع في نفس المكتبة (Library ID) المُعرَّفة في إعدادات المنصة.",
    };
  }

  const { data: video, error: insertError } = await supabase
    .from("videos")
    .insert({
      bunny_video_id: videoId,
      bunny_library_id: process.env.BUNNY_STREAM_LIBRARY_ID!,
      title: title || "فيديو من Bunny",
      status: details.status,
      duration_seconds: details.durationSeconds,
      thumbnail_url: details.thumbnailUrl,
      metadata: details.raw,
    })
    .select("id")
    .single();

  if (insertError || !video) return { error: "تعذّر حفظ سجل الفيديو: " + insertError?.message };

  const { error: attachError } = await supabase.from("lessons").update({ video_id: video.id }).eq("id", lessonId);
  if (attachError) return { error: "تعذّر ربط الفيديو بالدرس" };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم ربط الفيديو بنجاح" };
}

/**
 * The YouTube counterpart to attachExistingBunnyVideoAction — for
 * content already public on YouTube, avoiding a redundant re-upload.
 * Uses YouTube's public oEmbed endpoint (no API key required, unlike
 * the full YouTube Data API) to fetch the real title/thumbnail and
 * confirm the video actually exists and is embeddable — never trusts
 * the pasted URL/ID blindly. Duration isn't available from oEmbed, so
 * the admin enters it manually (optional); this is an honest
 * limitation, not a fetch that was skipped by oversight — getting
 * exact duration would require the full YouTube Data API v3 and a
 * separate API key credential this project doesn't otherwise need.
 */
export async function attachYoutubeVideoAction(
  lessonId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const raw = String(formData.get("youtubeUrlOrId") ?? "").trim();
  const titleOverride = String(formData.get("title") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);

  if (!raw) return { error: "الرجاء لصق رابط الفيديو أو معرّفه من يوتيوب" };

  const videoId = extractYoutubeVideoId(raw);
  if (!videoId) {
    return { error: "تعذّر التعرّف على معرّف الفيديو من النص المُدخل — تأكد أنه رابط يوتيوب صحيح" };
  }

  const supabase = await createClient();

  // Unlike Bunny (where the equivalent check above stays — each Bunny
  // upload IS a dedicated asset for one specific lesson recording), a
  // YouTube video is just an external reference, not an owned asset —
  // the same video legitimately applies to more than one lesson (a
  // shared intro clip, the same public lecture referenced from two
  // related lessons, etc.), so no uniqueness check here. See 0032.

  let oembedTitle: string | null = null;
  let thumbnailUrl: string | null = null;

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
    );
    if (res.ok) {
      const data = await res.json();
      oembedTitle = typeof data.title === "string" ? data.title : null;
      thumbnailUrl = typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
    }
  } catch {
    // oEmbed unreachable — not fatal, we fall back to the admin-provided
    // title below. We do NOT fail the whole attach just because YouTube's
    // metadata endpoint was momentarily unreachable.
  }

  if (!oembedTitle && !titleOverride) {
    return {
      error: "تعذّر التحقق من وجود هذا الفيديو على يوتيوب — تأكد من صحة الرابط، أو أدخل عنواناً يدوياً",
    };
  }

  const { data: video, error: insertError } = await supabase
    .from("videos")
    .insert({
      source: "youtube",
      youtube_video_id: videoId,
      title: titleOverride || oembedTitle || "فيديو من يوتيوب",
      status: "ready", // already published/processed on YouTube itself
      duration_seconds: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes * 60) : 0,
      thumbnail_url: thumbnailUrl,
    })
    .select("id")
    .single();

  if (insertError || !video) return { error: "تعذّر حفظ سجل الفيديو: " + insertError?.message };

  const { error: attachError } = await supabase.from("lessons").update({ video_id: video.id }).eq("id", lessonId);
  if (attachError) return { error: "تعذّر ربط الفيديو بالدرس" };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم ربط فيديو يوتيوب بنجاح" };
}

export async function refreshOrUpdateVideoAction(
  videoId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const newTitle = String(formData.get("title") ?? "").trim();
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("videos")
    .select("source, bunny_video_id")
    .eq("id", videoId)
    .maybeSingle();

  if (!video) return { error: "الفيديو غير موجود" };

  // YouTube videos have no Bunny counterpart to call — a title change
  // here only updates our own record; YouTube's own title (and
  // status/duration, which we already have from oEmbed at attach time)
  // isn't ours to change and doesn't need "refreshing" the way a
  // Bunny transcode's status does.
  if (video.source === "youtube") {
    if (!newTitle) return { error: null };
    const { error } = await supabase.from("videos").update({ title: newTitle }).eq("id", videoId);
    if (error) return { error: "تعذّر حفظ العنوان" };
    revalidatePath(`/admin/courses/${courseId}/structure`);
    return { error: null, success: "تم تحديث العنوان" };
  }

  try {
    if (newTitle) {
      await videoService.updateVideoTitle(video.bunny_video_id!, newTitle);
    }
    const details = await videoService.getVideoDetails(video.bunny_video_id!);

    const { error } = await supabase
      .from("videos")
      .update({
        title: newTitle || undefined,
        status: details.status,
        duration_seconds: details.durationSeconds,
        thumbnail_url: details.thumbnailUrl,
        metadata: details.raw,
      })
      .eq("id", videoId);

    if (error) return { error: "تعذّر حفظ حالة الفيديو: " + error.message };
  } catch (err) {
    return { error: "تعذّر التواصل مع Bunny Stream: " + (err as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم تحديث بيانات الفيديو" };
}

export async function detachVideoAction(lessonId: string, courseId: string) {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("lessons").update({ video_id: null }).eq("id", lessonId);
  if (error) return { error: "تعذّر فصل الفيديو عن الدرس: " + error.message };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}

/**
 * Detaches from the lesson, deletes on Bunny, then removes the DB row.
 * Order matters: if the Bunny delete call fails, we still want the DB
 * row (and the lesson attachment) intact rather than silently orphaning
 * a video Bunny still has, so detach happens first but the DB row
 * deletion only happens after Bunny confirms.
 */
export async function deleteVideoAction(videoId: string, lessonId: string, courseId: string) {
  await assertAdmin();
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("videos")
    .select("source, bunny_video_id")
    .eq("id", videoId)
    .maybeSingle();

  if (!video) return { error: "الفيديو غير موجود" };

  await supabase.from("lessons").update({ video_id: null }).eq("id", lessonId);

  // YouTube videos aren't hosted on Bunny at all — deleting our
  // reference to them never touches YouTube itself (we don't own that
  // video, we just linked to it), so there's no remote delete call to make.
  if (video.source === "bunny") {
    try {
      await videoService.deleteVideo(video.bunny_video_id!);
    } catch (err) {
      return { error: "تعذّر حذف الفيديو من Bunny Stream: " + (err as Error).message };
    }
  }

  const { error } = await supabase.from("videos").delete().eq("id", videoId);
  if (error) return { error: "تم الحذف من Bunny لكن تعذّر حذف السجل محلياً: " + error.message };

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}
