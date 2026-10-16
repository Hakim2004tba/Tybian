/**
 * What a teacher pastes for a live session, and what to embed for it.
 *
 * Vimeo has TWO different things behind near-identical URLs, and they
 * do not share an embed:
 *
 *   a live event   vimeo.com/event/<id>      → vimeo.com/event/<id>/embed
 *   a video        vimeo.com/<id>            → player.vimeo.com/video/<id>
 *
 * Both ids are just digits, so the existing video extractor happily
 * reads `vimeo.com/event/1234567` as the VIDEO 1234567 and builds a
 * player URL for a video that either does not exist or belongs to
 * somebody else. That is why events are parsed here first and by their
 * own rule rather than being folded into extractVimeoVideoId.
 *
 * Both kinds are accepted on purpose. A live event needs a Vimeo plan
 * that can stream; a plain video does not, and a teacher who records a
 * session and posts it afterwards should be able to use the same field
 * rather than wait for an upgrade.
 *
 * Pure and DEPENDENCY-FREE, like every other unit-tested module here:
 * the test runner strips types but does not resolve the `@/` alias, so
 * a module with imports cannot be tested directly. The video branch
 * therefore repeats the rules of extractVimeoVideoId rather than
 * calling it — and tests/vimeo-event.test.ts asserts the two agree on
 * every shape, so the duplication cannot drift unnoticed.
 */

export type VimeoSource =
  | { kind: "event"; id: string; hash: string | null }
  | { kind: "video"; id: string; hash: string | null };

export function extractVimeoSource(input: string): VimeoSource | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  /*
    Events first. `/event/<id>` optionally carries the unlisted hash as
    a further segment, and the embed form already contains `/embed`,
    which a teacher copying from Vimeo's own embed dialog will paste.
  */
  const event = trimmed.match(
    /vimeo\.com\/event\/(\d{5,})(?:\/embed)?(?:\/([a-zA-Z0-9]+))?/
  );
  if (event) {
    const hash = event[2] && event[2] !== "embed" ? event[2] : null;
    return { kind: "event", id: event[1], hash };
  }

  /* Bare "123456789" or "123456789/abc123def4" */
  const bare = trimmed.match(/^(\d{6,})(?:\/([a-zA-Z0-9]+))?$/);
  if (bare) return { kind: "video", id: bare[1], hash: bare[2] ?? null };

  /* player.vimeo.com/video/<id>, hash carried as ?h= */
  const player = trimmed.match(/player\.vimeo\.com\/video\/(\d{6,})/);
  if (player) {
    const h = trimmed.match(/[?&]h=([a-zA-Z0-9]+)/);
    return { kind: "video", id: player[1], hash: h ? h[1] : null };
  }

  /* vimeo.com/<…segments…>/<id>[/<hash>] */
  const web = trimmed.match(/vimeo\.com\/(?:[\w-]+\/)*?(\d{6,})(?:\/([a-zA-Z0-9]+))?/);
  if (web) return { kind: "video", id: web[1], hash: web[2] ?? null };

  return null;
}

/**
 * The URL to put in the iframe.
 *
 * `dnt=1` on both: Vimeo's tracking cookies are not something a student
 * opted into by opening a lecture.
 */
export function buildVimeoSourceEmbedUrl(source: VimeoSource): string {
  if (source.kind === "event") {
    const base = source.hash
      ? `https://vimeo.com/event/${source.id}/embed/${source.hash}`
      : `https://vimeo.com/event/${source.id}/embed`;
    return `${base}?dnt=1`;
  }

  const params = new URLSearchParams();
  if (source.hash) params.set("h", source.hash);
  params.set("title", "0");
  params.set("byline", "0");
  params.set("portrait", "0");
  params.set("dnt", "1");
  return `https://player.vimeo.com/video/${source.id}?${params.toString()}`;
}

/** How the reference is stored: "event:<id>[:<hash>]" or "video:<id>[:<hash>]". */
export function serializeVimeoSource(source: VimeoSource): string {
  return [source.kind, source.id, source.hash].filter(Boolean).join(":");
}

export function parseVimeoSource(stored: string | null): VimeoSource | null {
  if (!stored) return null;
  const [kind, id, hash] = stored.split(":");
  if ((kind !== "event" && kind !== "video") || !id) return null;
  return { kind, id, hash: hash || null };
}
