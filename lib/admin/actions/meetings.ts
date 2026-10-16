"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, query, toSql } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { newRoomName } from "@/lib/data/meetings";
import { getDictionary } from "@/lib/i18n/locale";
import { extractVimeoSource, serializeVimeoSource } from "@/lib/video/extract-vimeo-event";
import { notifyMany } from "@/lib/notify";

export type ActionState = { error: string | null; success?: string | null; redirectTo?: string };

/**
 * Scheduling and cancelling live sessions. Admin only — every entry
 * point starts with requireRouteAccess("/admin").
 */

/**
 * The local datetime the form submits, turned into UTC for storage.
 *
 * `<input type="datetime-local">` hands back a wall-clock string with no
 * zone ("2026-09-20T18:00"). Stored as-is it would be read back as UTC
 * and the session would appear an hour off — the same class of bug that
 * put `created_at` an hour ahead across this database. The browser's own
 * offset is submitted alongside it so the conversion is exact.
 */
function toUtc(local: string, offsetMinutes: number): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const naive = Date.parse(`${local}:00Z`);
  if (Number.isNaN(naive)) return null;
  return new Date(naive + offsetMinutes * 60_000);
}

export async function createMeetingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRouteAccess("/admin");
  const { dict } = await getDictionary();
  const t = dict.admin.meetings;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const scope = String(formData.get("scope") ?? "");
  const courseId = String(formData.get("courseId") ?? "").trim() || null;
  const yearId = String(formData.get("academicYearId") ?? "").trim() || null;
  const teacherId = String(formData.get("teacherId") ?? "").trim() || null;
  const startsLocal = String(formData.get("startsAt") ?? "");
  const offset = Number(formData.get("tzOffset") ?? "0");
  const duration = Number(formData.get("durationMinutes") ?? "60");

  if (!title) return { error: t.errTitle };

  /*
    Exactly one scope. Both empty would create a session nobody can
    open; both set would make "who may attend" ambiguous, and an
    ambiguous access rule is a broken one.
  */
  const course = scope === "course" ? courseId : null;
  const year = scope === "year" ? yearId : null;
  if (!course && !year) return { error: t.errScope };

  const startsAt = toUtc(startsLocal, Number.isFinite(offset) ? offset : 0);
  if (!startsAt) return { error: t.errStart };

  if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
    return { error: t.errDuration };
  }

  /*
    The Vimeo link, if one was given. Parsed here rather than stored raw
    so a typo is refused while the teacher is still looking at the form,
    instead of becoming a blank player at the start of the lecture.
    Empty stays empty — the event is usually made nearer the time.
  */
  const streamUrl = String(formData.get("streamUrl") ?? "").trim();
  let streamSource: string | null = null;
  if (streamUrl) {
    const parsed = extractVimeoSource(streamUrl);
    if (!parsed) return { error: t.errStreamLink };
    streamSource = serializeVimeoSource(parsed);
  }

  await execute(
    `INSERT INTO meetings
       (id, title, description, course_id, academic_year_id, teacher_id,
        room_name, stream_source, starts_at, duration_minutes, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    [
      newId(),
      title.slice(0, 191),
      description,
      course,
      year,
      teacherId,
      newRoomName(),
      streamSource,
      toSql(startsAt),
      Math.round(duration),
      user.id,
    ]
  );

  /*
    Tell the people who may attend. A live session nobody knew about
    is a live session nobody attends, and the schedule page is not
    somewhere students check unprompted.
  */
  const audience = await query<{ id: string }>(
    course
      ? `SELECT DISTINCT e.user_id AS id
           FROM enrollments e
          WHERE e.course_id = ? AND e.deleted_at IS NULL
            AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))`
      : `SELECT id FROM profiles
          WHERE academic_year_id = ? AND deleted_at IS NULL AND role = 'student'`,
    [course ?? year]
  );
  await notifyMany(
    audience.map((a) => a.id),
    {
      type: "course_update",
      title: "لقاء مباشر جديد",
      body: title,
      entityType: "meeting",
      entityId: null,
    }
  );

  revalidatePath("/admin/meetings");
  revalidatePath("/dashboard");
  return { error: null, success: t.created };
}

export async function cancelMeetingAction(id: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();

  /*
    Cancelled, not deleted: the attendance of a session that already ran
    is a record the teacher may need, and the row is what ties it to a
    course. `status` also closes the join window on its own.
  */
  await execute(`UPDATE meetings SET status = 'cancelled' WHERE id = ? AND deleted_at IS NULL`, [id]);

  revalidatePath("/admin/meetings");
  revalidatePath("/dashboard");
  return { error: null, success: dict.admin.meetings.cancelled };
}

export async function deleteMeetingAction(id: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();

  await execute(`UPDATE meetings SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?`, [id]);

  revalidatePath("/admin/meetings");
  revalidatePath("/dashboard");
  return { error: null, success: dict.admin.meetings.deleted };
}
