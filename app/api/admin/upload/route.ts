import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireRouteAccess } from "@/lib/auth/session";

/**
 * POST /api/admin/upload
 *
 * Replaces the browser's direct upload to Supabase Storage. Images now
 * land on the server's own disk, which is what the hosting plan
 * provides — 150 GB of it, against a 5 MB cap per image.
 *
 * The bytes do pass through this server, which the Supabase version
 * deliberately avoided. That principle still holds for VIDEO, which is
 * why Bunny keeps handling those uploads directly from the browser and
 * is untouched by this port. A 5 MB cover image is a different
 * proposition from a 2 GB lecture recording.
 *
 * Bunny's own upload flow is unaffected: it never went through Supabase.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKETS = ["course-covers", "avatars"] as const;
type Bucket = (typeof BUCKETS)[number];

/**
 * Extensions are chosen from the MIME type, never taken from the
 * uploaded filename. A filename is attacker-controlled: accepting its
 * extension is how "logo.png.html" or a traversal like "../../x" ends up
 * written into a served directory.
 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  // Redirects a non-admin. Uploads write to a publicly served directory,
  // so this is the whole boundary — the bucket policies that used to
  // gate the equivalent Supabase write are gone.
  await requireRouteAccess("/admin");

  const formData = await request.formData();
  const file = formData.get("file");
  const bucket = String(formData.get("bucket") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (!BUCKETS.includes(bucket as Bucket)) {
    return NextResponse.json({ error: "bad_bucket" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json({ error: "bad_type" }, { status: 415 });
  }

  // The name is a fresh uuid, so two people uploading "cover.jpg" cannot
  // collide and no user-supplied text ever reaches the filesystem.
  const filename = `${randomUUID()}.${extension}`;
  const directory = join(process.cwd(), "public", "uploads", bucket);

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  // A root-relative URL, not an absolute one: the site is about to move
  // domains, and a stored absolute URL would outlive the hostname it was
  // written with.
  return NextResponse.json({ url: `/uploads/${bucket}/${filename}` });
}
