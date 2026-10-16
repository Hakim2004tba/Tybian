import { NextResponse } from "next/server";
import { execute, newId, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getTeacherScope, ownsLesson } from "@/lib/data/teacher";
import { storeLibraryFile } from "@/lib/library/storage";

/**
 * POST /api/teacher/resources/upload — an attachment for one lesson.
 *
 * Open to teachers AND admins: getTeacherScope() already returns every
 * course for an admin and only their own for a teacher, so one route
 * serves both without a second permission branch to keep in step.
 *
 * A route rather than a server action, for the same reason as the
 * library upload: an action buffers the whole request body before its
 * code runs, so a 20 MB slide deck would be held in memory per
 * concurrent upload on a host with a small allowance.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const scope = await getTeacherScope();
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);

  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  /*
    Ownership of the LESSON, proved here rather than trusted from the
    form. Passing the teacher tier says the caller is a teacher; it says
    nothing about whose lesson they just named.
  */
  if (!(await ownsLesson(scope, lessonId))) {
    return NextResponse.json({ error: "not_your_lesson" }, { status: 403 });
  }

  const originalName = file.name.slice(0, 255) || "attachment";

  let filePath: string;
  try {
    filePath = await storeLibraryFile(
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
      originalName,
      "attachments"
    );
  } catch (error) {
    console.error("attachment upload failed", error);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  const positionRow = await queryOne<{ n: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM lesson_resources
      WHERE lesson_id = ? AND deleted_at IS NULL`,
    [lessonId]
  );

  const id = newId();
  await execute(
    `INSERT INTO lesson_resources (id, lesson_id, title, file_url, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      lessonId,
      // An untitled upload is named after the file rather than refused:
      // a teacher is usually adding several at once.
      title || originalName.replace(/\.[^.]+$/, ""),
      filePath,
      Number(positionRow?.n ?? 0),
    ]
  );

  return NextResponse.json({ id });
}
