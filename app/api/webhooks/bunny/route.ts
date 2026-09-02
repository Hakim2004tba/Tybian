import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { videoService } from "@/lib/video";

/**
 * POST /api/webhooks/bunny?secret=...
 *
 * Bunny Stream's webhook does not HMAC-sign its payload (unlike
 * Chargily's checkout webhook), so the practical verification mechanism
 * is a shared secret configured as a query string param on the webhook
 * URL entered in the Bunny dashboard — compared against
 * BUNNY_STREAM_WEBHOOK_SECRET here. This is a known, documented
 * limitation of Bunny's webhook design, not an oversight in this
 * implementation.
 *
 * Rather than trust the exact shape of Bunny's webhook body (which has
 * varied across their API versions), this handler treats the webhook as
 * a "something changed, go check" signal and re-fetches canonical
 * details via videoService.getVideoDetails() — the same method the
 * admin's manual "refresh" action uses, so there's exactly one code
 * path that knows how to interpret Bunny's video-details response.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!process.env.BUNNY_STREAM_WEBHOOK_SECRET || secret !== process.env.BUNNY_STREAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { VideoGuid?: string; VideoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const providerVideoId = body.VideoGuid ?? body.VideoId;
  if (!providerVideoId) {
    return NextResponse.json({ error: "missing_video_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: video } = await admin
    .from("videos")
    .select("id")
    .eq("bunny_video_id", providerVideoId)
    .maybeSingle();

  if (!video) {
    // Not necessarily an error — could be a video created outside this
    // flow, or already deleted locally. Acknowledge so Bunny doesn't retry.
    return NextResponse.json({ ok: true, note: "no matching video row" });
  }

  try {
    const details = await videoService.getVideoDetails(providerVideoId);
    await admin
      .from("videos")
      .update({
        status: details.status,
        duration_seconds: details.durationSeconds,
        thumbnail_url: details.thumbnailUrl,
        metadata: details.raw,
      })
      .eq("id", video.id);
  } catch (err) {
    // Log and 200 anyway — Bunny will retry a 5xx, but a transient
    // failure here shouldn't cause webhook retry storms; the admin's
    // manual refresh action is the fallback.
    console.error("Bunny webhook: failed to sync video details", err);
  }

  return NextResponse.json({ ok: true });
}
