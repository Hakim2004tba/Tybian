import { createHash } from "node:crypto";

/**
 * Pure, deterministic Bunny Stream signature helpers — deliberately kept
 * free of the `server-only` import (unlike bunny.ts) so they can be unit
 * tested with plain `node --experimental-strip-types`, without Next.js's
 * build-time module-boundary enforcement getting in the way. The actual
 * BunnyStreamVideoService class (which DOES need the server-only guard,
 * since it holds live API credentials in memory) wraps these.
 */

export function computeUploadSignature(params: {
  libraryId: string;
  apiKey: string;
  expiresAt: number;
  videoId: string;
}): string {
  return createHash("sha256")
    .update(`${params.libraryId}${params.apiKey}${params.expiresAt}${params.videoId}`)
    .digest("hex");
}

export function computePlaybackToken(params: {
  tokenAuthKey: string;
  videoId: string;
  expiresAt: number;
}): string {
  return createHash("sha256")
    .update(`${params.tokenAuthKey}${params.videoId}${params.expiresAt}`)
    .digest("hex");
}
