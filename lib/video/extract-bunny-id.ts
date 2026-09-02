/**
 * Accepts what an admin might paste after uploading a video directly on
 * Bunny's own dashboard: the raw video GUID, an iframe embed URL
 * (https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}), a
 * direct HLS playlist URL, or any other Bunny URL containing the GUID
 * as a path segment — and extracts just the GUID. Kept pure/dependency-free
 * so it's directly unit-testable (see tests/bunny-id-extraction.test.ts).
 */
export function extractBunnyVideoId(input: string): string | null {
  const trimmed = input.trim();
  const guidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const match = trimmed.match(guidPattern);
  return match ? match[0].toLowerCase() : null;
}
