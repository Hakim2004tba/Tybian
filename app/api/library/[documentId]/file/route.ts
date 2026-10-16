import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { visibleDocument, rememberDocumentAccess, recallDocumentAccess } from "@/lib/data/library";
import { cookies } from "next/headers";
import { resolveLibraryPath } from "@/lib/library/storage";

/**
 * GET /api/library/<documentId>/file — the only way a library file
 * reaches a browser.
 *
 * These documents are not in public/ precisely so that this check
 * exists: a session, and a document the session's owner is allowed to
 * read. See lib/library/storage.ts for why.
 *
 * RANGE REQUESTS are honoured because PDF.js asks for them. Given a
 * server that answers 206, it fetches a 40 MB lecture in the few tens of
 * kilobytes it needs to draw page 1 and pulls the rest as the student
 * scrolls. Answering 200 with the whole file instead works, but every
 * open costs the full download — on a phone, on Algerian mobile data.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  /*
    The session cookie identifies the memo entry below. It is read
    before anything else because a request with no cookie has nothing
    to look up and nothing to authorise.
  */
  const sessionId = (await cookies()).get("tibyan_session")?.value ?? null;

  /*
    A PDF reader issues many range requests for one document. The first
    pays for the full check; the rest reuse it for a few seconds. See
    rememberDocumentAccess() in lib/data/library.ts for the cost of
    that trade.
  */
  let doc = sessionId ? recallDocumentAccess(sessionId, documentId) : null;

  if (!doc) {
    const user = await getSessionUser();
    if (!user) return new NextResponse("unauthorised", { status: 401 });

    const profile = await queryOne<{ academic_year_id: string | null }>(
      `SELECT academic_year_id FROM profiles WHERE id = ?`,
      [user.id]
    );

    doc = await visibleDocument(
      documentId,
      profile?.academic_year_id ?? null,
      user.role === "admin"
    );

    if (doc && sessionId) rememberDocumentAccess(sessionId, documentId, doc);
  }
  // 404, not 403: a student who may not read a document should not learn
  // that it exists.
  if (!doc) return new NextResponse("not found", { status: 404 });

  const path = resolveLibraryPath(doc.filePath);
  if (!path) return new NextResponse("not found", { status: 404 });

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new NextResponse("not found", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  /*
    RFC 5987 encoding for the filename. Arabic and French names are
    normal here ("Anatomie — appareil locomoteur.pdf"), and a raw
    non-ASCII byte in a header is what turns a download into a corrupted
    name or a rejected response.
  */
  const asciiName = doc.originalName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const disposition =
    `${download ? "attachment" : "inline"}; filename="${asciiName}"; ` +
    `filename*=UTF-8''${encodeURIComponent(doc.originalName)}`;

  const headers: Record<string, string> = {
    "Content-Type": doc.mimeType,
    "Content-Disposition": disposition,
    "Accept-Ranges": "bytes",
    /*
      private, and never shared: this response is scoped to one session.
      A shared cache in front of this host holding it would serve one
      year's document to another year's student.
    */
    "Cache-Control": "private, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const startRaw = match[1];
      const endRaw = match[2];

      // "bytes=-500" means the LAST 500 bytes, not "up to 500".
      let start = startRaw === "" ? size - Number(endRaw) : Number(startRaw);
      let end = startRaw === "" ? size - 1 : endRaw === "" ? size - 1 : Number(endRaw);

      start = Math.max(0, start);
      end = Math.min(size - 1, end);

      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        const stream = createReadStream(path, { start, end });
        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Content-Length": String(end - start + 1),
          },
        });
      }

      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
  }

  const stream = createReadStream(path);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}
