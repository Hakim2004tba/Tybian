import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "@/lib/auth/session";

/**
 * POST /api/upload/avatar
 *
 * Replaces the browser's direct upload to Supabase Storage for the
 * student's own profile picture.
 *
 * Migration 0039's storage policy rejected any path whose first folder
 * was not the caller's own id — "an honest path is enforced by the
 * database, not by this component". There is no storage policy now, so
 * the path is not accepted from the client at all: it is built here from
 * the session's user id, which the client cannot influence.
 */

const MAX_BYTES = 3 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // Extension from the MIME type, never the filename: a filename is
  // attacker-controlled, and its extension is how "x.png.html" or a
  // traversal ends up written into a served directory.
  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json({ error: "bad_type" }, { status: 415 });
  }

  /*
    A fresh uuid per upload rather than a stable `<uid>/avatar.ext`.

    The old path was stable and needed a cache-busting query string
    appended, because browsers kept showing the previous picture. A new
    name each time makes the URL change on its own, which is simpler and
    cannot go stale. The old file is left on disk — 3 MB against 150 GB,
    and losing the previous avatar to a failed save would be worse.
  */
  const filename = `${user.id}-${randomUUID()}.${extension}`;
  const directory = join(process.cwd(), "public", "uploads", "avatars");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    console.error("avatar upload failed", error);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  // Root-relative, matching what setAvatarUrlAction accepts.
  return NextResponse.json({ url: `/uploads/avatars/${filename}` });
}
