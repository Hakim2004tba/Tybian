import "server-only";
import { queryOne } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * TIBYAN — authorization.
 *
 * This module is what 0009_rls_policies.sql used to be. Postgres applied
 * those 82 policies to every query automatically, whichever code path
 * asked and whether or not the author remembered; MariaDB applies
 * nothing. So the rules are here, written once, and the discipline that
 * replaces RLS is simple and absolute:
 *
 *   Any read of paid or private content calls a function in this file
 *   first. No exceptions, no "this one is obviously fine".
 *
 * The rules themselves are unchanged — deliberately. Each function below
 * names the policy or database function it came from so the two can be
 * compared. This is a port, not a redesign: if behaviour differs from the
 * Postgres original, that is a bug in this file.
 *
 * What is NOT here: the decision logic in lib/video/access.ts and
 * lib/auth/route-access.ts. Those were already pure functions and already
 * unit-tested, and they stay exactly as they are. This file only gathers
 * facts for them, which is the half that used to be Supabase's job.
 */

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/** The signed-in user, or throws. For paths that must not be public. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("unauthenticated");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError("admin only");
  return user;
}

/**
 * Was `is_admin()` in 0007_functions_and_triggers.sql, which read the JWT
 * claim. Reads the session's role instead, so it reflects the profiles
 * table as of this request.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return user?.role === "admin";
}

/* ------------------------------------------------------------------ */
/* Enrollment — the rule that protects the revenue                     */
/* ------------------------------------------------------------------ */

/**
 * Was `has_active_enrollment(p_user_id, p_course_id)`.
 *
 * Three conditions, and all three matter:
 *
 *   deleted_at IS NULL   — the enrollment was not revoked. Refunds and
 *                          chargebacks soft-delete rather than erase, so
 *                          forgetting this clause hands access back to
 *                          everyone who was ever refunded.
 *   starts_at  <= now    — an admin-granted enrollment can begin later.
 *   expires_at IS NULL   — NULL means lifetime; a date means the
 *     OR > now             three-month plan, and it must not have passed.
 *
 * UTC_TIMESTAMP(3) rather than NOW(): NOW() follows the connection's
 * timezone, and on shared hosting that is whatever the host set. Every
 * timestamp in this schema is UTC, so the comparison must be too — a
 * mismatch here would expire enrollments hours early or late.
 */
export async function hasActiveEnrollment(userId: string, courseId: string): Promise<boolean> {
  const row = await queryOne<{ ok: number }>(
    `SELECT 1 AS ok
       FROM enrollments
      WHERE user_id = ?
        AND course_id = ?
        AND deleted_at IS NULL
        AND starts_at <= UTC_TIMESTAMP(3)
        AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
      LIMIT 1`,
    [userId, courseId]
  );
  return row !== null;
}

/** Throws unless the current user may study this course. Admins pass. */
export async function requireEnrollment(courseId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "admin") return user;
  if (await isOwningTeacher(user.id, courseId)) return user;
  if (await hasActiveEnrollment(user.id, courseId)) return user;
  throw new ForbiddenError("not enrolled");
}

/* ------------------------------------------------------------------ */
/* Ownership                                                           */
/* ------------------------------------------------------------------ */

/**
 * Is this user the teacher who owns the course?
 *
 * Note the two hops: courses.teacher_id points at teachers.id, and it is
 * teachers.profile_id that is the user. Comparing the user id against
 * courses.teacher_id directly is the mistake this function exists to
 * prevent — it would silently never match, and every owning teacher would
 * be locked out of their own drafts.
 */
export async function isOwningTeacher(userId: string, courseId: string): Promise<boolean> {
  const row = await queryOne<{ ok: number }>(
    `SELECT 1 AS ok
       FROM courses c
       JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = ? AND t.profile_id = ?
      LIMIT 1`,
    [courseId, userId]
  );
  return row !== null;
}

/** The course that a lesson belongs to, via its section. */
export async function courseIdForLesson(lessonId: string): Promise<string | null> {
  const row = await queryOne<{ course_id: string }>(
    `SELECT cs.course_id
       FROM lessons cs_l
       JOIN course_sections cs ON cs.id = cs_l.section_id
      WHERE cs_l.id = ? AND cs_l.deleted_at IS NULL
      LIMIT 1`,
    [lessonId]
  );
  return row?.course_id ?? null;
}

/**
 * May the current user see this course at all?
 *
 * Published courses are public — the catalogue is meant to be browsable
 * by signed-out visitors, so this is deliberately not behind requireUser.
 * Drafts and archived courses are visible only to their owning teacher
 * and to admins, which is what the `courses_select_*` policies said.
 */
export async function canViewCourse(courseId: string): Promise<boolean> {
  const course = await queryOne<{ status: string }>(
    `SELECT status FROM courses WHERE id = ? AND deleted_at IS NULL`,
    [courseId]
  );
  if (!course) return false;
  if (course.status === "published") return true;

  const user = await getSessionUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  return isOwningTeacher(user.id, courseId);
}

/* ------------------------------------------------------------------ */
/* Row ownership — "your own rows only"                                */
/* ------------------------------------------------------------------ */

/**
 * The shape of most of the replaced policies: notes, progress, favourites,
 * notifications, orders, payments and study rows were all readable and
 * writable only by the user they belong to, with admins able to read
 * everything.
 *
 * Callers pass the row's user_id. Comparing it here rather than filtering
 * in each query means the check reads the same way everywhere and cannot
 * be quietly forgotten in a WHERE clause.
 */
export async function requireOwnership(rowUserId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.id === rowUserId) return user;
  if (user.role === "admin") return user;
  throw new ForbiddenError("not your row");
}

/** Non-throwing form, for read paths that hide rather than reject. */
export async function ownsOrAdmin(rowUserId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  return user.id === rowUserId || user.role === "admin";
}
