import "server-only";
import type {
  VideoService,
  VideoDetails,
  UploadCredentials,
  PlaybackAuthorization,
} from "@/lib/video/VideoService";
import { computeUploadSignature, computePlaybackToken } from "@/lib/video/bunny-signing";

type BunnyConfig = {
  libraryId: string;
  apiKey: string;
  cdnHostname: string;
  tokenAuthKey: string;
};

const API_BASE = "https://video.bunnycdn.com/library";
const TUS_UPLOAD_ENDPOINT = "https://video.bunnycdn.com/tusupload";

function mapStatus(bunnyStatus: number): VideoDetails["status"] {
  // Bunny's numeric status codes: 0=Created,1=Uploaded,2=Processing,
  // 3=Transcoding,4=Finished,5=Error,6=UploadFailed
  if (bunnyStatus === 4) return "ready";
  if (bunnyStatus === 5 || bunnyStatus === 6) return "failed";
  return "processing";
}

/**
 * Bunny Stream implementation of VideoService.
 *
 * Config (library id, API key, token-auth key, CDN hostname) is injected
 * via the constructor rather than read from `process.env` inside each
 * method — this is what makes the signature-generation logic below
 * unit-testable without touching real env vars (see
 * tests/bunny-signing.test.ts) and keeps this class provider-agnostic in
 * shape (a future MuxVideoService would take its own equivalent config).
 *
 * `import "server-only"` at the top of this file (and VideoService.ts)
 * makes any accidental Client Component import of this class — and
 * therefore of `apiKey`/`tokenAuthKey` — a build-time error, not a
 * runtime credential leak.
 *
 * API reference (Bunny Stream / Video Library API):
 *  - Create video:  POST   /library/{libraryId}/videos
 *  - Get video:     GET    /library/{libraryId}/videos/{videoId}
 *  - Update video:  POST   /library/{libraryId}/videos/{videoId}
 *  - Delete video:  DELETE /library/{libraryId}/videos/{videoId}
 *  - TUS resumable upload: https://video.bunnycdn.com/tusupload
 *    (the browser uploads directly here — video bytes never pass
 *    through our Next.js server or Vercel functions)
 *  - Signed embed playback: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?token=...&expires=...
 */
export class BunnyStreamVideoService implements VideoService {
  private config: BunnyConfig;

  constructor(config: BunnyConfig) {
    this.config = config;
  }

  private async bunnyFetch(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API_BASE}/${this.config.libraryId}${path}`, {
      ...init,
      headers: {
        AccessKey: this.config.apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Bunny Stream API error (${res.status}): ${body || res.statusText}`);
    }

    return res;
  }

  async createVideo(title: string): Promise<{ providerVideoId: string }> {
    const res = await this.bunnyFetch("/videos", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    const data = (await res.json()) as { guid: string };
    return { providerVideoId: data.guid };
  }

  getUploadCredentials(providerVideoId: string, ttlSeconds = 1800): UploadCredentials {
    // Bunny's presigned-TUS-upload signature formula (per their docs):
    // sha256_hex(libraryId + apiKey + expirationTimestamp + videoId).
    // Purely computational — no network call needed, so this can stay
    // synchronous, matching the VideoService interface.
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = computeUploadSignature({
      libraryId: this.config.libraryId,
      apiKey: this.config.apiKey,
      expiresAt,
      videoId: providerVideoId,
    });

    return {
      providerVideoId,
      uploadEndpoint: TUS_UPLOAD_ENDPOINT,
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expiresAt),
        VideoId: providerVideoId,
        LibraryId: this.config.libraryId,
      },
      expiresAt,
    };
  }

  async getVideoDetails(providerVideoId: string): Promise<VideoDetails> {
    const res = await this.bunnyFetch(`/videos/${providerVideoId}`);
    const data = (await res.json()) as {
      status: number;
      length: number;
      thumbnailFileName: string | null;
      [key: string]: unknown;
    };

    return {
      providerVideoId,
      status: mapStatus(data.status),
      durationSeconds: data.length ?? 0,
      thumbnailUrl: data.thumbnailFileName ? this.getThumbnailUrl(providerVideoId, data.thumbnailFileName) : null,
      raw: data,
    };
  }

  async updateVideoTitle(providerVideoId: string, title: string): Promise<void> {
    await this.bunnyFetch(`/videos/${providerVideoId}`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  async deleteVideo(providerVideoId: string): Promise<void> {
    await this.bunnyFetch(`/videos/${providerVideoId}`, { method: "DELETE" });
  }

  getPlaybackAuthorization(providerVideoId: string, ttlSeconds = 21600): PlaybackAuthorization {
    // Bunny Stream embed-view token auth formula (per their docs):
    // token = sha256_hex(tokenAuthKey + videoId + expires)
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = computePlaybackToken({
      tokenAuthKey: this.config.tokenAuthKey,
      videoId: providerVideoId,
      expiresAt,
    });

    const playbackUrl =
      `https://iframe.mediadelivery.net/embed/${this.config.libraryId}/${providerVideoId}` +
      `?token=${token}&expires=${expiresAt}`;

    return { playbackUrl, thumbnailUrl: this.getThumbnailUrl(providerVideoId), expiresAt };
  }

  getThumbnailUrl(providerVideoId: string, fileName = "thumbnail.jpg"): string {
    return `https://${this.config.cdnHostname}/${providerVideoId}/${fileName}`;
  }
}
