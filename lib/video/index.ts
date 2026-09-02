import "server-only";
import { BunnyStreamVideoService } from "@/lib/video/providers/bunny";
import type { VideoService } from "@/lib/video/VideoService";

/**
 * TIBYAN uses Bunny Stream as its only video provider (see Architecture
 * doc §5 and this feature's requirements). To switch providers later:
 * write a new class implementing VideoService in lib/video/providers/,
 * then change ONLY the instantiation below — every admin action, the
 * playback Route Handler, and the webhook handler import `videoService`
 * from here and never reference Bunny directly.
 */
export const videoService: VideoService = new BunnyStreamVideoService({
  libraryId: process.env.BUNNY_STREAM_LIBRARY_ID!,
  apiKey: process.env.BUNNY_STREAM_API_KEY!,
  cdnHostname: process.env.BUNNY_STREAM_PULL_ZONE_HOSTNAME!,
  tokenAuthKey: process.env.BUNNY_STREAM_TOKEN_AUTH_KEY!,
});
