/**
 * Accepts a raw YouTube video ID, or any common YouTube URL format, and
 * extracts just the 11-character video ID. Same "accept whatever an
 * admin pastes" spirit as lib/video/extract-bunny-id.ts, and kept pure
 * so it's directly unit-testable (see tests/youtube-id-extraction.test.ts).
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  const idPattern = /^[a-zA-Z0-9_-]{11}$/;

  if (idPattern.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return null;
}
