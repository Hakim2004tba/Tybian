import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { getMeeting, canAttend, isHost, joinWindow } from "@/lib/data/meetings";
import { requireRouteAccess } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/locale";
import { MeetingStream } from "@/components/meetings/MeetingStream";
import { MeetingChat } from "@/components/meetings/MeetingChat";
import { listMessages } from "@/lib/data/meeting-chat";
import { parseVimeoSource, buildVimeoSourceEmbedUrl } from "@/lib/video/extract-vimeo-event";

/**
 * The room page.
 *
 * Every gate is here, on the SERVER, before the embed URL reaches the
 * browser at all. That ordering is the whole security model: the embed
 * link IS the access, so a page that rendered it and then hid the
 * player behind a client-side check would have already given the
 * broadcast away to anyone reading the HTML. An unlisted Vimeo event
 * plays for whoever holds its link, exactly as the old room name did.
 */
export const dynamic = "force-dynamic";

export default async function MeetingRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRouteAccess("/dashboard");
  const { dict } = await getDictionary();
  const t = dict.meetings;

  const meeting = await getMeeting(id);
  if (!meeting) notFound();

  const allowed = await canAttend(meeting, user);
  const win = joinWindow(meeting);

  if (!allowed) {
    return (
      <div className="px-md py-lg md:px-xl md:py-xl">
        <div className="mx-auto max-w-lg rounded-xl border border-white/70 bg-white px-lg py-12 text-center">
          <ShieldAlert size={28} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14.5px] text-text-primary-light">{t.notAllowed}</p>
          <Link
            href="/dashboard/meetings"
            className="mt-5 inline-flex items-center gap-2 text-[13.5px] font-semibold text-primary"
          >
            <ArrowRight size={15} />
            {t.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const profile = await queryOne<{ full_name: string }>(
    `SELECT full_name FROM profiles WHERE id = ? LIMIT 1`,
    [user.id]
  );

  const host = await isHost(meeting, user);

  /* Resolved on the SERVER. The stored reference never reaches the
     browser as-is — the page sends only the URL to put in the frame. */
  const embedUrl = (() => {
    const source = parseVimeoSource(meeting.stream_source);
    return source ? buildVimeoSourceEmbedUrl(source) : null;
  })();
  const messages = await listMessages(meeting.id);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-bold text-text-primary-light">{meeting.title}</h1>
          <p className="mt-0.5 text-[12.5px] text-text-muted-light">{t.shareWarning}</p>
        </div>
        <Link
          href="/dashboard/meetings"
          className="inline-flex shrink-0 items-center gap-2 text-[13px] font-semibold text-primary"
        >
          <ArrowRight size={15} />
          {t.backToList}
        </Link>
      </div>

      {/*
        The stream appears only while the door is open; the discussion
        is always there. A student who arrives the night before can
        still ask — which is the reason this panel exists at all, and
        it matters more now than it did: a Vimeo broadcast carries no
        back-channel of its own, so this is the only way to ask.
      */}
      {win.isOpen ? (
        <MeetingStream
          meetingId={meeting.id}
          embedUrl={embedUrl}
          title={meeting.title}
          isHost={host}
        />
      ) : (
        <p className="rounded-xl border border-border-light bg-white px-lg py-8 text-center text-[13.5px] text-text-secondary-light">
          {meeting.status === "cancelled" || meeting.status === "ended"
            ? t.closed
            : new Date() < win.opensAt
              ? t.notOpenYet
              : t.closed}
        </p>
      )}

      <div className="mt-5">
        <MeetingChat
          meetingId={meeting.id}
          initialMessages={messages}
          currentUserId={user.id}
          canPin={host}
        />
      </div>
    </div>
  );
}
