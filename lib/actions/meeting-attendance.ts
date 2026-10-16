"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getMeeting, canAttend, joinWindow, recordAttendance } from "@/lib/data/meetings";

/**
 * Heartbeat from a student sitting in a live session.
 *
 * Deliberately takes ONLY the meeting id. The caller never supplies the
 * user id or how long they have been present — both are decided here,
 * from the session cookie and the clock. A client that could name its
 * own user id could write attendance for somebody else; one that could
 * name its own duration could award itself an hour it never sat through.
 */
export async function meetingHeartbeatAction(meetingId: string): Promise<{ ok: boolean }> {
  /*
    getSessionUser, not requireAuth: requireAuth REDIRECTS, which is the
    right answer for a page and the wrong one for a background beat —
    the browser would follow it and the caller would be parsing a login
    page as if it were a result. A signed-out beat simply fails.
  */
  const user = await getSessionUser();
  if (!user) return { ok: false };

  const meeting = await getMeeting(meetingId);
  if (!meeting) return { ok: false };

  /*
    Eligibility is re-checked on every beat, not just at the door. An
    enrolment can lapse mid-session, and a session that has ended should
    stop accruing presence even if a tab is left open overnight.
  */
  if (!(await canAttend(meeting, user))) return { ok: false };
  if (!joinWindow(meeting).isOpen) return { ok: false };

  await recordAttendance(meetingId, user.id);
  return { ok: true };
}
