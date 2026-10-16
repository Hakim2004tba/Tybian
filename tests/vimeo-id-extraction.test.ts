import assert from "node:assert/strict";
import { extractVimeoVideoId, buildVimeoEmbedUrl } from "../lib/video/extract-vimeo-id.ts";

const cases: [string, { videoId: string; hash: string | null } | null][] = [
  ["123456789", { videoId: "123456789", hash: null }],
  ["123456789/abc123def4", { videoId: "123456789", hash: "abc123def4" }],
  ["https://vimeo.com/123456789", { videoId: "123456789", hash: null }],
  ["https://vimeo.com/123456789/abc123def4", { videoId: "123456789", hash: "abc123def4" }],
  ["http://vimeo.com/123456789", { videoId: "123456789", hash: null }],
  ["https://player.vimeo.com/video/123456789", { videoId: "123456789", hash: null }],
  ["https://player.vimeo.com/video/123456789?h=abc123def4", { videoId: "123456789", hash: "abc123def4" }],
  ["https://vimeo.com/channels/staffpicks/123456789", { videoId: "123456789", hash: null }],
  ["  https://vimeo.com/123456789/abc123def4  ", { videoId: "123456789", hash: "abc123def4" }],
  ['<iframe src="https://player.vimeo.com/video/123456789?h=abc123def4" width="640"></iframe>', { videoId: "123456789", hash: "abc123def4" }],
  ["", null],
  ["not a link", null],
  ["https://youtube.com/watch?v=dQw4w9WgXcQ", null],
];

let passed = 0;
for (const [input, expected] of cases) {
  const actual = extractVimeoVideoId(input);
  assert.deepEqual(actual, expected, `extractVimeoVideoId(${JSON.stringify(input)})`);
  passed++;
}

// The hash MUST survive into the embed URL — an unlisted video will not
// play without it, which is the whole reason it is stored separately.
const withHash = buildVimeoEmbedUrl("123456789", "abc123def4");
assert.ok(withHash.startsWith("https://player.vimeo.com/video/123456789?"), "embed base URL");
assert.ok(withHash.includes("h=abc123def4"), "hash carried into embed URL");
passed++;

const noHash = buildVimeoEmbedUrl("123456789", null);
assert.ok(!noHash.includes("h="), "no empty h= for a public video");
passed++;

console.log(`vimeo-id-extraction: ${passed} assertions passed`);
