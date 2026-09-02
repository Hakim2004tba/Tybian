// Run with: node --experimental-strip-types tests/bunny-id-extraction.test.ts

import { extractBunnyVideoId } from "../lib/video/extract-bunny-id.ts";

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

const GUID = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";

check("raw GUID, as-is", extractBunnyVideoId(GUID), GUID);
check("raw GUID with surrounding whitespace", extractBunnyVideoId(`  ${GUID}  `), GUID);
check("uppercase GUID gets lowercased", extractBunnyVideoId(GUID.toUpperCase()), GUID);

check(
  "iframe embed URL",
  extractBunnyVideoId(`https://iframe.mediadelivery.net/embed/123456/${GUID}`),
  GUID
);
check(
  "iframe embed URL with query params",
  extractBunnyVideoId(`https://iframe.mediadelivery.net/embed/123456/${GUID}?autoplay=true&token=abc`),
  GUID
);
check(
  "direct HLS playlist URL",
  extractBunnyVideoId(`https://vz-abcdef.b-cdn.net/${GUID}/playlist.m3u8`),
  GUID
);
check(
  "thumbnail URL",
  extractBunnyVideoId(`https://vz-abcdef.b-cdn.net/${GUID}/thumbnail.jpg`),
  GUID
);

check("empty string returns null", extractBunnyVideoId(""), null);
check("unrelated text returns null", extractBunnyVideoId("hello world"), null);
check("a random non-GUID URL returns null", extractBunnyVideoId("https://example.com/video/123"), null);
check("a truncated/malformed GUID returns null", extractBunnyVideoId("a1b2c3d4-e5f6-4789"), null);

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
