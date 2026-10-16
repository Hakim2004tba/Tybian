import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { execute, newId, queryOne } from "@/lib/db";
import { storeLibraryFile, kindFor } from "@/lib/library/storage";
import { libraryReady } from "@/lib/data/library";

/**
 * POST /api/admin/library/upload — one course document.
 *
 * A route rather than a server action: an action buffers the entire
 * request body before its code runs, so a 40 MB lecture would be held
 * in memory per concurrent upload on a host with a small memory
 * allowance. This reads the file once and writes it straight out.
 *
 * NOTE ON THE HOST: nginx in front of Passenger caps request bodies —
 * commonly at 50 MB, sometimes less. A file above that is rejected
 * before this handler ever runs, which looks like a silent failure in
 * the browser. MAX_BYTES is set below that line on purpose so the
 * refusal comes from here, with a message, rather than from the proxy.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 40 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await libraryReady())) {
    return NextResponse.json({ error: "not_installed" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folderId = String(formData.get("folderId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  const folder = await queryOne<{ id: string }>(
    `SELECT id FROM library_folders WHERE id = ? AND deleted_at IS NULL`,
    [folderId]
  );
  if (!folder) {
    return NextResponse.json({ error: "bad_folder" }, { status: 400 });
  }

  /*
    The browser's reported type, with a fallback. Firefox sends an empty
    string for some files and Safari has been known to send
    application/octet-stream for a PDF; both would land in `other` and
    lose the reader. The extension is only consulted to recover the one
    format that has a reader, and never to build a path.
  */
  let mime = file.type || "application/octet-stream";
  if (mime === "application/octet-stream" && file.name.toLowerCase().endsWith(".pdf")) {
    mime = "application/pdf";
  }

  const originalName = file.name.slice(0, 255) || "document";

  let filePath: string;
  try {
    filePath = await storeLibraryFile(
      Buffer.from(await file.arrayBuffer()),
      mime,
      originalName
    );
  } catch (error) {
    console.error("library upload failed", error);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  const positionRow = await queryOne<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM library_documents
      WHERE folder_id = ? AND deleted_at IS NULL`,
    [folderId]
  );

  const id = newId();
  await execute(
    `INSERT INTO library_documents
       (id, folder_id, title, description, file_path, original_name, mime_type,
        size_bytes, kind, sort_order, is_published, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      folderId,
      // An untitled upload is named after the file rather than refused:
      // the admin is usually adding ten at a time.
      title || originalName.replace(/\.[^.]+$/, ""),
      description,
      filePath,
      originalName,
      mime,
      file.size,
      kindFor(mime),
      Number(positionRow?.n ?? 0),
      user.id,
    ]
  );

  return NextResponse.json({ id });
}
