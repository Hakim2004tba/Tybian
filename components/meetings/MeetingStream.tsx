"use client";

import { useEffect } from "react";
import { Radio, ExternalLink } from "lucide-react";
import { meetingHeartbeatAction } from "@/lib/actions/meeting-attendance";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** How often we tell the server the student is still here. */
const HEARTBEAT_MS = 60_000;

/**
 * The live session, played inside a TIBYAN page.
 *
 * WHAT REPLACED WHAT: this used to be a Jitsi room — a two-way call
 * where everyone could speak. It is now a Vimeo broadcast: the teacher
 * streams from their own Vimeo account and students watch. That is a
 * deliberate change of shape, not a like-for-like swap, and the two
 * consequences are worth naming because they are visible to students:
 *
 *   - nobody but the teacher is heard or seen. For a lecture to a whole
 *     year that is an improvement — a hundred open microphones is not a
 *     lecture — but it is not a tutorial where students answer back.
 *   - the back-channel now matters. Jitsi carried its own chat inside
 *     the call; this does not, so the platform's own discussion panel
 *     under the player is the only way to ask, and it stays open before
 *     and after the broadcast rather than existing only during it.
 *
 * The platform keeps everything around the video exactly as before: who
 * may enter, when the door opens, and who was actually present.
 */
export function MeetingStream({
  meetingId,
  embedUrl,
  title,
  isHost,
}: {
  meetingId: string;
  embedUrl: string | null;
  title: string;
  isHost: boolean;
}) {
  const { t } = useI18n();
  const m = t.meetings;

  /*
    Attendance is recorded from a timer, not from player events: those
    fire in the browser and a closed laptop never sends the last one. A
    beat that stops arriving IS the leave, and the server credits only
    the gaps short enough to mean presence.

    It runs whether or not a stream is attached — a student sitting on
    the page at the appointed hour was present, and marking them absent
    because the teacher had not pasted a link yet would punish them for
    somebody else's omission.
  */
  useEffect(() => {
    void meetingHeartbeatAction(meetingId);
    const id = setInterval(() => void meetingHeartbeatAction(meetingId), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [meetingId]);

  /* No link yet. Said plainly, and differently to the teacher — they
     are the one who can fix it. */
  if (!embedUrl) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-border-light bg-surface-light p-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Radio size={20} />
        </span>
        <p className="text-[14px] font-semibold text-text-primary-light">{m.noStreamTitle}</p>
        <p className="max-w-md text-[13px] leading-relaxed text-text-secondary-light">
          {isHost ? m.noStreamHost : m.noStreamStudent}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-light bg-black">
      <div className="relative aspect-video w-full">
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          /* `autoplay` is NOT granted: a lecture that starts talking
             the moment a page opens is how a student in a library gets
             caught out. They press play. */
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {isHost && (
        <div className="flex items-center justify-between gap-3 bg-academy-deep px-4 py-2.5">
          <p className="text-[12.5px] text-white/70">{m.hostHint}</p>
          <a
            href="https://vimeo.com/manage/events"
            target="_blank"
            rel="noreferrer noopener"
            className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-white hover:underline"
          >
            {m.openVimeo}
            <ExternalLink size={13} />
          </a>
        </div>
      )}
    </div>
  );
}
