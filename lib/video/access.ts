/**
 * TIBYAN — video playback access decision.
 *
 * This is a pure function on purpose, following the exact same pattern
 * as lib/auth/route-access.ts: the decision logic is separated from the
 * Supabase I/O that gathers the facts (see get-access-facts.ts), so it
 * can be unit-tested without a database — see
 * tests/video-access.test.ts.
 *
 * This function is THE security boundary for "can this request get a
 * signed Bunny playback URL for this lesson" — it implements, in order,
 * every check requested:
 *   1. authenticated
 *   2. lesson exists
 *   3. course access (published, or owner/admin bypass)
 *   4. enrollment (which itself encodes expiration — see
 *      has_active_enrollment() in 0007_functions_and_triggers.sql)
 *   5. free-preview exception
 *
 * "Lesson ownership" (item 5 in the request) is expressed here as
 * `isOwningTeacher` — a teacher may always preview lessons in their own
 * course regardless of status/enrollment, matching the RLS rule already
 * established for `courses`/`lessons` in 0009_rls_policies.sql.
 */

export type VideoAccessFacts = {
  authenticated: boolean;
  lessonExists: boolean;
  courseStatus: "draft" | "published" | "archived" | null;
  isFreePreview: boolean;
  isActivelyEnrolled: boolean; // already accounts for expiration + revocation
  isOwningTeacher: boolean;
  isAdmin: boolean;
};

export type VideoAccessDenyReason =
  | "unauthenticated"
  | "not_found"
  | "course_unavailable"
  | "not_enrolled";

export type VideoAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: VideoAccessDenyReason };

export function decideVideoAccess(facts: VideoAccessFacts): VideoAccessDecision {
  if (!facts.authenticated) return { allowed: false, reason: "unauthenticated" };
  if (!facts.lessonExists) return { allowed: false, reason: "not_found" };

  // Admins and the owning teacher can always preview their own content,
  // including drafts, mirroring the RLS policy for course_sections/lessons.
  if (facts.isAdmin) return { allowed: true };
  if (facts.isOwningTeacher) return { allowed: true };

  // Everyone else needs the course to actually be published.
  if (facts.courseStatus !== "published") return { allowed: false, reason: "course_unavailable" };

  // Free-preview lessons are viewable by any authenticated user on a
  // published course, without requiring enrollment.
  if (facts.isFreePreview) return { allowed: true };

  // Otherwise, access requires a currently-active (non-expired,
  // non-revoked) enrollment in this specific course.
  if (facts.isActivelyEnrolled) return { allowed: true };

  return { allowed: false, reason: "not_enrolled" };
}

export const denyReasonMessage: Record<VideoAccessDenyReason, string> = {
  unauthenticated: "الرجاء تسجيل الدخول لمشاهدة هذا الدرس",
  not_found: "الدرس غير موجود",
  course_unavailable: "هذه الدورة غير متاحة حالياً",
  not_enrolled: "يجب الاشتراك في هذه الدورة لمشاهدة هذا الدرس",
};
