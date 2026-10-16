import "server-only";
import { getLessonAccessFacts } from "@/lib/video/get-access-facts";
import { decideVideoAccess, denyReasonMessage, type VideoAccessDenyReason } from "@/lib/video/access";
import { buildVimeoEmbedUrl } from "@/lib/video/extract-vimeo-id";
import { queryOne } from "@/lib/db";

export type ResolvePlaybackResult =
  | {
      ok: true;
      source: "youtube" | "vimeo";
      playbackUrl: string;
      thumbnailUrl: string | null;
      durationSeconds: number;
      /** Neither remaining provider issues an expiring URL, so this is a
       *  far-future sentinel. It is kept in the shape because callers
       *  (the playback route, the learn page) branch on it, and because
       *  a provider that *does* sign URLs could be added back later. */
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
 * IMPORTANT HONEST CAVEAT — read before treating this as DRM: neither
 * remaining provider issues a signed, time-limited, per-viewer playback
 * URL the way Bunny Stream did. This function still fully controls
 * WHETHER a student receives a URL (enrollment and free-preview are
 * checked identically for both sources), but once the URL reaches a
 * browser, YouTube/Vimeo do not re-verify TIBYAN's decision on each
 * request. Anyone who captures the URL could replay it outside the
 * platform.
 *
 * The mitigation is provider-side and MUST be configured there, not
 * here: on Vimeo set each video to "hide from vimeo.com" and restrict
 * embedding to the platform's own domain, so a captured URL fails to
 * play anywhere else. This is an inherent trade-off of using embeddable
 * third-party hosts, not a bug in this code.
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

  /*
    The only read of a provider id outside the admin editor.

    It happens AFTER decideVideoAccess() has returned allowed, a few
    lines above. Under RLS this needed the service_role client because
    `videos` was admin-only; with no policies the ordering of these two
    steps IS the protection. Do not move this read above the decision.
  */
  const video = await queryOne<{
    source: "youtube" | "vimeo";
    youtube_video_id: string | null;
    vimeo_video_id: string | null;
    vimeo_hash: string | null;
    status: string;
    duration_seconds: number;
    thumbnail_url: string | null;
  }>(
    `SELECT source, youtube_video_id, vimeo_video_id, vimeo_hash,
            status, duration_seconds, thumbnail_url
       FROM videos WHERE id = ? AND deleted_at IS NULL`,
    [lesson.videoId]
  );

  if (!video || video.status !== "ready") {
    return { ok: false, reason: "video_not_ready", message: "الفيديو قيد التجهيز، حاول مجدداً بعد قليل" };
  }

  const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;

  if (video.source === "vimeo") {
    return {
      ok: true,
      source: "vimeo",
      playbackUrl: buildVimeoEmbedUrl(video.vimeo_video_id!, video.vimeo_hash),
      thumbnailUrl: video.thumbnail_url,
      durationSeconds: video.duration_seconds,
      expiresAt: farFuture,
    };
  }

  return {
    ok: true,
    source: "youtube",
    playbackUrl: `https://www.youtube.com/embed/${video.youtube_video_id}?rel=0&modestbranding=1`,
    thumbnailUrl: video.thumbnail_url,
    durationSeconds: video.duration_seconds,
    expiresAt: farFuture,
  };
}
