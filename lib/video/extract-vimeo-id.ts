/**
 * Accepts whatever an admin might paste after uploading a video to
 * Vimeo, and pulls out the numeric video ID plus the privacy hash when
 * one is present.
 *
 * The hash matters: an *unlisted* Vimeo video lives at
 * vimeo.com/<id>/<hash> and its embed refuses to play without that
 * hash, so losing it during paste is the difference between a working
 * lesson and a dead player. A public video simply has no hash.
 *
 * Recognised shapes:
 *   123456789
 *   123456789/abc123def4
 *   https://vimeo.com/123456789
 *   https://vimeo.com/123456789/abc123def4
 *   https://player.vimeo.com/video/123456789
 *   https://player.vimeo.com/video/123456789?h=abc123def4
 *   https://vimeo.com/channels/staffpicks/123456789
 *   <iframe src="https://player.vimeo.com/video/123456789?h=abc123def4" …>
 *
 * Kept pure/dependency-free so it is directly unit-testable — see
 * tests/vimeo-id-extraction.test.ts.
 */
export type VimeoRef = { videoId: string; hash: string | null };

export function extractVimeoVideoId(input: string): VimeoRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare "123456789" or "123456789/abc123def4"
  const bare = trimmed.match(/^(\d{6,})(?:\/([a-zA-Z0-9]+))?$/);
  if (bare) return { videoId: bare[1], hash: bare[2] ?? null };

  // player.vimeo.com/video/<id> with the hash carried as ?h=
  const player = trimmed.match(/player\.vimeo\.com\/video\/(\d{6,})/);
  if (player) {
    const h = trimmed.match(/[?&]h=([a-zA-Z0-9]+)/);
    return { videoId: player[1], hash: h ? h[1] : null };
  }

  // vimeo.com/<…segments…>/<id>[/<hash>] — covers plain links, channel
  // and group links, and the unlisted <id>/<hash> form.
  const web = trimmed.match(/vimeo\.com\/(?:[\w-]+\/)*?(\d{6,})(?:\/([a-zA-Z0-9]+))?/);
  if (web) return { videoId: web[1], hash: web[2] ?? null };

  return null;
}

/**
 * The canonical embed URL for a stored Vimeo reference. The hash has to
 * ride along as `h=` or an unlisted video returns a privacy error
 * instead of playing.
 */
export function buildVimeoEmbedUrl(videoId: string, hash: string | null): string {
  const params = new URLSearchParams();
  if (hash) params.set("h", hash);
  params.set("title", "0");
  params.set("byline", "0");
  params.set("portrait", "0");
  params.set("dnt", "1");
  return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
}
