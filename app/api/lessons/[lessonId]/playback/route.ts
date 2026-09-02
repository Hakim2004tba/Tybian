import { NextResponse } from "next/server";
import { resolvePlayback } from "@/lib/video/resolve-playback";

/**
 * GET /api/lessons/:lessonId/playback
 *
 * Thin HTTP wrapper around resolvePlayback() — see that file for the
 * actual "gather facts → decide → act" pipeline (also used directly by
 * the /courses/:slug/learn page's initial server render). This endpoint
 * exists for CLIENT-SIDE re-fetches — e.g. refreshing an expired signed
 * URL without a full page reload — never as a second, divergent
 * authorization implementation.
 *
 * `Cache-Control: no-store` on every response so a CDN/browser never
 * serves a stale signed URL — or a stale allow/deny decision — to a
 * different user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const result = await resolvePlayback(lessonId);

  if (!result.ok) {
    const status =
      result.reason === "unauthenticated" ? 401 : result.reason === "not_found" ? 404 : 403;
    return NextResponse.json(
      { error: result.reason, message: result.message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      source: result.source,
      playbackUrl: result.playbackUrl,
      thumbnailUrl: result.thumbnailUrl,
      durationSeconds: result.durationSeconds,
      expiresAt: result.expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
