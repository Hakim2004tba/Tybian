// Verifies the Bunny Stream signature math against their documented
// formulas, deterministically (no network call, no real Bunny account
// needed). Imports the pure helpers directly (lib/video/bunny-signing.ts
// has no `server-only` guard) rather than the BunnyStreamVideoService
// class itself, since that class's other imports intentionally throw
// outside a Next.js build — see that file's doc comment.
//
// Run with: node --experimental-strip-types tests/bunny-signing.test.ts

import { computeUploadSignature, computePlaybackToken } from "../lib/video/bunny-signing.ts";
import { createHash } from "node:crypto";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) {
    console.log(`[FAIL] ${name}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

// --- Upload signature: sha256_hex(libraryId + apiKey + expires + videoId) ---
{
  const params = { libraryId: "12345", apiKey: "test-api-key", expiresAt: 1_700_001_800, videoId: "abc-123-def" };
  const actual = computeUploadSignature(params);
  const expected = createHash("sha256")
    .update(`${params.libraryId}${params.apiKey}${params.expiresAt}${params.videoId}`)
    .digest("hex");

  check("upload signature matches Bunny's documented formula exactly", actual, expected);
  check("upload signature is a 64-char hex string (sha256)", /^[0-9a-f]{64}$/.test(actual), true);
  check("upload signature never contains the raw apiKey substring", actual.includes(params.apiKey), false);
  check("upload signature changes if videoId changes", computeUploadSignature({ ...params, videoId: "different" }) !== actual, true);
  check("upload signature changes if expiresAt changes", computeUploadSignature({ ...params, expiresAt: params.expiresAt + 1 }) !== actual, true);
}

// --- Playback token: sha256_hex(tokenAuthKey + videoId + expires) ---
{
  const params = { tokenAuthKey: "test-token-auth-key", videoId: "xyz-789", expiresAt: 1_700_021_600 };
  const actual = computePlaybackToken(params);
  const expected = createHash("sha256")
    .update(`${params.tokenAuthKey}${params.videoId}${params.expiresAt}`)
    .digest("hex");

  check("playback token matches Bunny's documented formula exactly", actual, expected);
  check("playback token is a 64-char hex string (sha256)", /^[0-9a-f]{64}$/.test(actual), true);
  check("playback token never contains the raw tokenAuthKey substring", actual.includes(params.tokenAuthKey), false);
  check("playback token changes if videoId changes", computePlaybackToken({ ...params, videoId: "different" }) !== actual, true);
  check("playback token changes if expiresAt changes (can't replay an expired token as a fresh one)", computePlaybackToken({ ...params, expiresAt: params.expiresAt + 1 }) !== actual, true);
  check("two different videos on the same library never share a token", computePlaybackToken({ ...params, videoId: "other-video" }) !== computePlaybackToken(params), true);
}

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
