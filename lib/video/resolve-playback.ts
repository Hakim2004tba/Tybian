import "server-only";
import { getLessonAccessFacts } from "@/lib/video/get-access-facts";
import { decideVideoAccess, denyReasonMessage, type VideoAccessDenyReason } from "@/lib/video/access";
import { videoService } from "@/lib/video";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResolvePlaybackResult =
  | {
      ok: true;
      source: "bunny" | "youtube";
      playbackUrl: string;
      thumbnailUrl: string | null;
      durationSeconds: number;
      /** Only meaningful for Bunny — a YouTube embed URL doesn't expire
       *  the way a signed Bunny token does. Set to a far-future value
       *  for YouTube so callers that check it don't need a special case. */
      expiresAt: number;
    }
  | { ok: false; reason: VideoAccessDenyReason | "no_video" | "video_not_ready"; message: string };

/**
 * The single implementation of the full "gather facts → decide → act"
 * pipeline (steps 1–7 from the Video Infrastructure requirements) —
 * both `/api/lessons/:id/playback` (used for client-side re-fetches)
 * and the `/courses/:slug/learn` page's initial server render call this
 * SAME function, so there is exactly one place that can grant a
 * playback URL. See lib/video/access.ts for the decision logic itself
 * and lib/video/get-access-facts.ts for how facts are gathered under
 * the caller's own RLS-scoped session.
 *
 * The `videos` table read (service_role, bypassing RLS) only ever
 * happens AFTER decideVideoAccess() returns allowed — never before.
 *
 * IMPORTANT HONEST CAVEAT for the YouTube branch: unlike Bunny's signed,
 * time-limited iframe token, a YouTube embed URL is NOT cryptographically
 * protected — this function still correctly enforces WHETHER a student
 * receives the URL (enrollment/free-preview is checked exactly the same
 * way for both sources), but once a YouTube URL is handed to the
 * browser, YouTube itself does not verify TIBYAN's access-control
 * decision on every request the way Bunny's token does. If the video is
 * Public or Unlisted on YouTube, someone who captures the URL could in
 * principle rewatch it directly on YouTube outside the platform. This
 * is an inherent trade-off of using YouTube as a source, not a bug —
 * worth the admin knowing when choosing which provider to attach a
 * given lesson's video from.
 */
export async function resolvePlayback(lessonId: string): Promise<ResolvePlaybackResult> {
  const { facts, lesson } = await getLessonAccessFacts(lessonId);
  const decision = decideVideoAccess(facts);

  if (!decision.allowed) {
    return { ok: false, reason: decision.reason, message: denyReasonMessage[decision.reason] };
  }

  if (!lesson?.videoId) {
    return { ok: false, reason: "no_video", message: "لم يُرفق فيديو لهذا الدرس بعد" };
  }

  const admin = createAdminClient();
  const { data: video } = await admin
    .from("videos")
    .select("source, bunny_video_id, youtube_video_id, status, duration_seconds, thumbnail_url")
    .eq("id", lesson.videoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!video || video.status !== "ready") {
    return { ok: false, reason: "video_not_ready", message: "الفيديو قيد التجهيز، حاول مجدداً بعد قليل" };
  }

  if (video.source === "youtube") {
    return {
      ok: true,
      source: "youtube",
      playbackUrl: `https://www.youtube.com/embed/${video.youtube_video_id}?rel=0&modestbranding=1`,
      thumbnailUrl: video.thumbnail_url,
      durationSeconds: video.duration_seconds,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // YouTube URLs don't expire; far-future sentinel
    };
  }

  const auth = videoService.getPlaybackAuthorization(video.bunny_video_id!);

  return {
    ok: true,
    source: "bunny",
    playbackUrl: auth.playbackUrl,
    thumbnailUrl: video.thumbnail_url ?? auth.thumbnailUrl,
    durationSeconds: video.duration_seconds,
    expiresAt: auth.expiresAt,
  };
}
