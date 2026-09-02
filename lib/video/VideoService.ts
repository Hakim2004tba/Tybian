import "server-only";

/**
 * TIBYAN — video provider abstraction.
 *
 * Every place in the app that needs to talk to a video provider goes
 * through THIS interface, never directly to Bunny's API. Swapping
 * providers later (e.g. to Mux or Cloudflare Stream) means writing one
 * new class implementing VideoService and changing the single wiring
 * point in lib/video/index.ts — no call site changes.
 *
 * Nothing in this file or its implementations is importable from a
 * Client Component: the `server-only` import at the top makes any such
 * import a build error rather than a silent credential leak.
 */

export type VideoStatus = "processing" | "ready" | "failed";

export type VideoDetails = {
  providerVideoId: string;
  status: VideoStatus;
  durationSeconds: number;
  thumbnailUrl: string | null;
  raw: Record<string, unknown>; // stored as-is into lessons.video_metadata
};

/**
 * Credentials handed to the BROWSER to upload directly to the provider.
 * By construction these must never include a raw, long-lived API key —
 * only a scoped, time-limited signature tied to one specific video.
 * (For BunnyStreamVideoService this is Bunny's documented TUS
 * AuthorizationSignature scheme — see providers/bunny.ts.)
 */
export type UploadCredentials = {
  providerVideoId: string;
  uploadEndpoint: string;
  headers: Record<string, string>;
  expiresAt: number; // unix seconds
};

export type PlaybackAuthorization = {
  playbackUrl: string;
  thumbnailUrl: string | null;
  expiresAt: number; // unix seconds
};

export interface VideoService {
  /** Registers a new video with the provider and returns its id. */
  createVideo(title: string): Promise<{ providerVideoId: string }>;

  /** Scoped, time-limited credentials for a direct browser→provider upload. */
  getUploadCredentials(providerVideoId: string, ttlSeconds?: number): UploadCredentials;

  /** Current encode status/duration/thumbnail from the provider. */
  getVideoDetails(providerVideoId: string): Promise<VideoDetails>;

  updateVideoTitle(providerVideoId: string, title: string): Promise<void>;

  deleteVideo(providerVideoId: string): Promise<void>;

  /** Short-lived signed playback authorization — never a raw API key. */
  getPlaybackAuthorization(providerVideoId: string, ttlSeconds?: number): PlaybackAuthorization;

  /** Deterministic thumbnail URL for a video (doesn't require an API call). */
  getThumbnailUrl(providerVideoId: string): string;
}
