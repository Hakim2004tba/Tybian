import assert from "node:assert/strict";
import {
  extractVimeoSource, buildVimeoSourceEmbedUrl, serializeVimeoSource, parseVimeoSource,
} from "../lib/video/extract-vimeo-event.ts";
import { extractVimeoVideoId } from "../lib/video/extract-vimeo-id.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
};

check("a live event link is read as an event, not as a video", () => {
  const s = extractVimeoSource("https://vimeo.com/event/1234567");
  assert.deepEqual(s, { kind: "event", id: "1234567", hash: null });
});

check("an event is NEVER turned into a player.vimeo video URL", () => {
  /* The whole reason this module exists: the video extractor reads the
     event id as a video id and builds a URL for someone else's video. */
  const url = buildVimeoSourceEmbedUrl(extractVimeoSource("https://vimeo.com/event/1234567")!);
  assert.ok(url.startsWith("https://vimeo.com/event/1234567/embed"), url);
  assert.ok(!url.includes("player.vimeo.com/video"), url);
});

check("the embed link Vimeo itself hands you is accepted", () => {
  assert.deepEqual(extractVimeoSource("https://vimeo.com/event/1234567/embed"), {
    kind: "event", id: "1234567", hash: null,
  });
});

check("an unlisted event keeps its hash, or it will not play", () => {
  const s = extractVimeoSource("https://vimeo.com/event/1234567/embed/abc123def4")!;
  assert.deepEqual(s, { kind: "event", id: "1234567", hash: "abc123def4" });
  assert.ok(buildVimeoSourceEmbedUrl(s).includes("/embed/abc123def4"));
});

check("'embed' is never mistaken for the hash", () => {
  const s = extractVimeoSource("https://vimeo.com/event/1234567/embed")!;
  assert.equal(s.hash, null);
});

check("a plain video link still works, for a recorded session", () => {
  const s = extractVimeoSource("https://vimeo.com/987654321")!;
  assert.deepEqual(s, { kind: "video", id: "987654321", hash: null });
  assert.ok(buildVimeoSourceEmbedUrl(s).startsWith("https://player.vimeo.com/video/987654321"));
});

check("an unlisted video keeps its hash", () => {
  const s = extractVimeoSource("https://vimeo.com/987654321/deadbeef12")!;
  assert.equal(s.hash, "deadbeef12");
  assert.ok(buildVimeoSourceEmbedUrl(s).includes("h=deadbeef12"));
});

check("tracking is off on both kinds", () => {
  for (const url of ["https://vimeo.com/event/1234567", "https://vimeo.com/987654321"]) {
    assert.ok(buildVimeoSourceEmbedUrl(extractVimeoSource(url)!).includes("dnt=1"), url);
  }
});

check("nonsense is rejected rather than half-parsed", () => {
  for (const bad of ["", "   ", "https://youtube.com/watch?v=abc", "not a link"]) {
    assert.equal(extractVimeoSource(bad), null, bad);
  }
});

check("what is stored comes back as what was parsed", () => {
  for (const url of [
    "https://vimeo.com/event/1234567",
    "https://vimeo.com/event/1234567/embed/abc123def4",
    "https://vimeo.com/987654321",
    "https://vimeo.com/987654321/deadbeef12",
  ]) {
    const s = extractVimeoSource(url)!;
    assert.deepEqual(parseVimeoSource(serializeVimeoSource(s)), s, url);
  }
});

check("a damaged stored value does not crash the page", () => {
  for (const bad of [null, "", "garbage", "event:", "sometthing:123"]) {
    assert.equal(parseVimeoSource(bad as string | null), null, String(bad));
  }
});

check("the duplicated video rules still match the original's", () => {
  /* extract-vimeo-event repeats these rules instead of importing them
     (the test runner cannot resolve the `@/` alias). This is what stops
     the copy drifting away from the original. */
  for (const url of [
    "123456789",
    "123456789/abc123def4",
    "https://vimeo.com/123456789",
    "https://vimeo.com/123456789/abc123def4",
    "https://player.vimeo.com/video/123456789",
    "https://player.vimeo.com/video/123456789?h=abc123def4",
    "https://vimeo.com/channels/staffpicks/123456789",
    '<iframe src="https://player.vimeo.com/video/123456789?h=abc123def4">',
    "not a link",
    "",
  ]) {
    const original = extractVimeoVideoId(url);
    const mine = extractVimeoSource(url);
    if (original === null) {
      assert.equal(mine, null, url);
    } else {
      assert.deepEqual(mine, { kind: "video", id: original.videoId, hash: original.hash }, url);
    }
  }
});

console.log(`${passed} passed, 0 failed (${passed} total assertions)`);
