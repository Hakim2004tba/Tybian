import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { queryOne } from "@/lib/db";
import { getLessonAccessFacts } from "@/lib/video/get-access-facts";
import { decideVideoAccess } from "@/lib/video/access";
import { resolveLibraryPath } from "@/lib/library/storage";

/**
 * GET /api/lessons/<lessonId>/resources/<resourceId>
 *
 * A lesson's attachment — the slides, the handout, the exercise sheet.
 *
 * NOT in public/uploads, where course covers live. An attachment is the
 * paid part of a course: anything under public/ is served by the web
 * server with no session check to whoever has or guesses the URL, and a
 * leaked link there can never be revoked. These sit in the same private
 * directory as the library and reach a browser only through here.
 *
 * ACCESS IS THE VIDEO'S DECISION, reused exactly. An attachment belongs
 * to a lesson, and whoever may watch that lesson may read its handout —
 * including the free-preview case. Writing a second rule here is how
 * the two would eventually disagree, and the disagreement would be
 * silent.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; resourceId: string }> }
) {
  const { lessonId, resourceId } = await params;

  const { facts } = await getLessonAccessFacts(lessonId);
  const decision = decideVideoAccess(facts);
  // 404, not 403: someone who may not read this should not learn it
  // exists.
  if (!decision.allowed) return new NextResponse("not found", { status: 404 });

  /*
    The lesson id is part of the WHERE, not just the URL. Without it a
    resource id from a lesson the caller cannot see would be served
    through a lesson they can.
  */
  const row = await queryOne<{ file_url: string; title: string }>(
    `SELECT file_url, title FROM lesson_resources
      WHERE id = ? AND lesson_id = ? AND deleted_at IS NULL`,
    [resourceId, lessonId]
  );
  if (!row) return new NextResponse("not found", { status: 404 });

  const path = resolveLibraryPath(row.file_url);
  if (!path) return new NextResponse("not found", { status: 404 });

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new NextResponse("not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  /* RFC 5987: Arabic and French filenames are normal here, and a raw
     non-ASCII byte in a header is a corrupted name or a refused
     response. */
  const ascii = row.title.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");

  const stream = createReadStream(path);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition":
        `${download ? "attachment" : "inline"}; filename="${ascii}"; ` +
        `filename*=UTF-8''${encodeURIComponent(row.title)}`,
      // private: this response is scoped to one session. A shared cache
      // holding it would hand a paid handout to a stranger.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
