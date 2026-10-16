import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

/**
 * Where library files live on disk, and why not in public/.
 *
 * Course covers and avatars go to public/uploads because they are meant
 * to be world-readable. University course documents are not: they are
 * the thing students come to the platform for, and anything under
 * public/ is served by the web server directly, with no session check,
 * to anyone who has or guesses the URL. A leaked link there is a
 * permanent, un-revocable hole.
 *
 * So these land OUTSIDE the served tree and reach the browser only
 * through app/api/library/[documentId]/file, which checks the session
 * and the student's academic year first.
 *
 * The directory sits BESIDE the app rather than inside it: a deploy
 * replaces the app folder, and uploaded files must outlive deploys.
 */
const ROOT = process.env.LIBRARY_DIR ?? join(process.cwd(), "..", "tibyan-library");

/** Extensions are decided by MIME type — never by the uploaded filename. */
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/msword": "doc",
  "application/zip": "zip",
};

export type DocumentKind = "pdf" | "image" | "text" | "other";

/**
 * How the reader will open this file.
 *
 * Only `pdf` gets the annotating reader — it is the one format the
 * browser can lay out with a selectable text layer, which is what
 * highlighting needs. Images render inline but cannot be highlighted
 * (there is no text to select), text renders as text, and everything
 * else is offered as a download.
 *
 * PPTX deliberately falls into `other`. Rendering it would need
 * LibreOffice on the server to convert it, which shared cPanel hosting
 * does not provide; pretending otherwise would ship a reader that shows
 * a blank page. The admin screen says so and asks for a PDF export
 * instead, which PowerPoint does in one step.
 */
export function kindFor(mime: string): DocumentKind {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/plain" || mime === "text/markdown") return "text";
  return "other";
}

export function extensionFor(mime: string, originalName: string): string {
  const known = EXTENSIONS[mime];
  if (known) return known;
  /*
    Fall back to the uploaded name's extension for a type we do not
    list — but only if it is plainly safe. This is the one place a
    filename influences the path, so it is narrowed to a few letters
    and digits: no dots, no slashes, nothing that can climb out of the
    directory or add a second extension.
  */
  const guess = originalName.split(".").pop() ?? "";
  return /^[a-zA-Z0-9]{1,8}$/.test(guess) ? guess.toLowerCase() : "bin";
}

/**
 * Writes the bytes and returns the RELATIVE path to store in the row.
 *
 * `subdir` keeps the two kinds of private file apart on disk — the
 * university library at the root, lesson attachments under
 * `attachments/` — without giving attachments a second storage module
 * that would have to repeat the path-escape guard below.
 */
export async function storeLibraryFile(
  bytes: Buffer,
  mime: string,
  originalName: string,
  subdir = ""
): Promise<string> {
  const extension = extensionFor(mime, originalName);
  // A fresh uuid: two uploads of "cours 1.pdf" cannot collide, and no
  // user-supplied text ever reaches the filesystem.
  const relative = subdir ? `${subdir}/${randomUUID()}.${extension}` : `${randomUUID()}.${extension}`;
  await mkdir(join(ROOT, subdir), { recursive: true });
  await writeFile(join(ROOT, relative), bytes);
  return relative;
}

/**
 * Resolves a stored relative path to an absolute one, refusing anything
 * that escapes the storage directory.
 *
 * The value comes from our own database, so this should never trigger —
 * which is exactly why it is here: the day something writes a path from
 * a less trusted source, this is what stops `../../.env` being served
 * to a signed-in student.
 */
export function resolveLibraryPath(relative: string): string | null {
  const full = normalize(join(ROOT, relative));
  const root = normalize(ROOT.endsWith(sep) ? ROOT : ROOT + sep);
  return full.startsWith(root) ? full : null;
}

export async function libraryFileSize(relative: string): Promise<number | null> {
  const full = resolveLibraryPath(relative);
  if (!full) return null;
  try {
    return (await stat(full)).size;
  } catch {
    return null;
  }
}

export async function deleteLibraryFile(relative: string): Promise<void> {
  const full = resolveLibraryPath(relative);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    // Already gone, or never written — the row is what matters.
  }
}
