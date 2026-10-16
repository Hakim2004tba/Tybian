// Run with: node --experimental-strip-types tests/youtube-id-extraction.test.ts

import { extractYoutubeVideoId } from "../lib/video/extract-youtube-id.ts";

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

const ID = "dQw4w9WgXcQ";

check("raw 11-char ID, as-is", extractYoutubeVideoId(ID), ID);
check("raw ID with surrounding whitespace", extractYoutubeVideoId(`  ${ID}  `), ID);

check("standard watch URL", extractYoutubeVideoId(`https://www.youtube.com/watch?v=${ID}`), ID);
check("watch URL with extra params", extractYoutubeVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`), ID);
check("youtu.be short URL", extractYoutubeVideoId(`https://youtu.be/${ID}`), ID);
check("youtu.be short URL with query", extractYoutubeVideoId(`https://youtu.be/${ID}?t=10`), ID);
check("embed URL", extractYoutubeVideoId(`https://www.youtube.com/embed/${ID}`), ID);
check("shorts URL", extractYoutubeVideoId(`https://www.youtube.com/shorts/${ID}`), ID);
check("no protocol/www variant", extractYoutubeVideoId(`youtube.com/watch?v=${ID}`), ID);

check("empty string returns null", extractYoutubeVideoId(""), null);
check("unrelated text returns null", extractYoutubeVideoId("hello world"), null);
check("a UUID (wrong format entirely) returns null", extractYoutubeVideoId("a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789"), null);
check("a random non-YouTube URL returns null", extractYoutubeVideoId("https://example.com/video/123"), null);
check("truncated ID (10 chars) returns null", extractYoutubeVideoId("dQw4w9WgXc"), null);

console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
