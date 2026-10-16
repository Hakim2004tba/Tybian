"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Pin, Trash2, CornerDownLeft, MessagesSquare } from "lucide-react";
import {
  fetchMeetingChatVersionAction,
  fetchMeetingMessagesAction,
  postMeetingMessageAction,
  deleteMeetingMessageAction,
  togglePinMeetingMessageAction,
} from "@/lib/actions/meeting-chat";
import type { MeetingThread, MeetingMessage } from "@/lib/data/meeting-chat";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The session's persistent discussion.
 *
 * This is now the ONLY chat. The Jitsi call it used to sit beside
 * carried its own, inside the video frame; a Vimeo broadcast carries
 * none, so every question a student asks goes through here — and
 * unlike a call's chat it exists before the session and survives it,
 * and it is the right tool for "can you repeat that". This is the part
 * that outlives the call: the question asked the night before, the
 * answer the teacher typed, the follow-up three days later.
 *
 * REFRESH BY POLLING, not by socket. This host restarts the Node
 * process on every request, so no connection survives between them —
 * see tibyan-db/mysql/04-meetings.sql. Polling is what is left, so it
 * is done carefully: only while the tab is actually visible, and at an
 * interval chosen for a classroom rather than a trading floor.
 */
/*
  ADAPTIVE POLLING.

  Ten seconds is right while a conversation is happening and wasteful
  when one is not — and a lecture is mostly not. Every quiet poll still
  costs a request, an access check and three queries, multiplied by
  everyone watching: five hundred viewers is about a hundred and fifty
  queries a second to establish that nothing has been said.

  So the interval stretches when nothing changes and snaps back the
  moment something does. A busy chat behaves exactly as before; an idle
  one costs a third as much. This is the cheap version of the fix —
  server-sent events are the real one, and the numbers do not justify
  them yet.
*/
const POLL_MIN_MS = 10_000;
const POLL_MAX_MS = 30_000;
const QUIET_POLLS_BEFORE_BACKOFF = 3;

export function MeetingChat({
  meetingId,
  initialMessages,
  currentUserId,
  canPin,
}: {
  meetingId: string;
  initialMessages: MeetingThread[];
  currentUserId: string;
  canPin: boolean;
}) {
  const { t: T, locale } = useI18n();
  const t = T.meetingChat;

  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });

  /*
    What the server last told us the thread looked like. A ref, not
    state: changing it must not re-render, and the poll closure must
    always see the latest value rather than the one captured when the
    interval was created.
  */
  const version = useRef<{ count: number; stamp: number } | null>(null);

  const refresh = useCallback(async () => {
    const result = await fetchMeetingMessagesAction(meetingId);
    if (result.ok) setMessages(result.messages);
  }, [meetingId]);

  /**
   * Ask for the cheap marker first, and fetch the thread only when it
   * has moved.
   *
   * In a quiet minute this turns every viewer's poll from "send me the
   * whole conversation" into a thirty-byte aggregate. With a lecture
   * audience that is the difference between a steady stream of full
   * thread renders and almost no load at all — see messagesVersion().
   */
  const poll = useCallback(async (): Promise<boolean> => {
    const seen = await fetchMeetingChatVersionAction(meetingId);
    if (!seen.ok) return false;

    const current = { count: seen.count ?? 0, stamp: seen.stamp ?? 0 };
    const previous = version.current;
    version.current = current;

    if (previous && previous.count === current.count && previous.stamp === current.stamp) {
      return false;
    }
    await refresh();
    return true;
  }, [meetingId, refresh]);

  /*
    A hidden tab polls nothing. Without the visibility check every
    backgrounded phone keeps asking the database for a conversation
    nobody is reading — the sort of quiet load a shared host feels
    long before anyone connects it to a chat panel.
  */
  useEffect(() => {
    let timer: number | undefined;
    let quiet = 0;
    let stopped = false;

    /*
      setTimeout that re-arms itself, not setInterval: the delay has to
      change between ticks, and an interval cannot do that without
      being torn down and rebuilt on every change.
    */
    const schedule = (ms: number) => {
      timer = window.setTimeout(run, ms);
    };

    const run = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") {
        // A hidden tab polls nothing — a backgrounded phone asking the
        // database about a conversation nobody is reading is exactly
        // the quiet load a shared host feels first.
        schedule(POLL_MIN_MS);
        return;
      }

      const changed = await poll();
      quiet = changed ? 0 : quiet + 1;

      const delay =
        quiet >= QUIET_POLLS_BEFORE_BACKOFF
          ? Math.min(POLL_MAX_MS, POLL_MIN_MS * (1 + (quiet - QUIET_POLLS_BEFORE_BACKOFF + 1)))
          : POLL_MIN_MS;

      schedule(delay);
    };

    /* Returning to the tab should feel instant, not "up to 30s". */
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        quiet = 0;
        window.clearTimeout(timer);
        void run();
      }
    };

    schedule(POLL_MIN_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  async function run(fn: () => Promise<{ ok: boolean; messages?: MeetingThread[]; error?: string }>) {
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (result.ok && result.messages) {
      setMessages(result.messages);
      /*
        Our own post/edit/delete already changed the server's version.
        Clearing the marker makes the next poll fetch rather than
        compare against a value we never observed — otherwise a second
        viewer's message arriving in the same window could be skipped.
      */
      version.current = null;
    }
    else if (!result.ok) setError(result.error ?? null);
    return result.ok;
  }

  async function send() {
    if (!draft.trim()) return;
    const ok = await run(() => postMeetingMessageAction(meetingId, draft));
    if (ok) setDraft("");
  }

  async function sendReply(parentId: string) {
    if (!replyDraft.trim()) return;
    const ok = await run(() => postMeetingMessageAction(meetingId, replyDraft, parentId));
    if (ok) {
      setReplyDraft("");
      setReplyTo(null);
    }
  }

  function Author({ m }: { m: MeetingMessage }) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] font-semibold text-text-primary-dark">{m.author_name}</span>
        {m.author_role === "teacher" && (
          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {t.roleTeacher}
          </span>
        )}
        {m.author_role === "admin" && (
          <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
            {t.roleAdmin}
          </span>
        )}
        <span className="num text-[11px] text-text-muted-dark">
          {fmt.format(new Date(`${m.created_at.replace(" ", "T")}Z`))}
        </span>
      </span>
    );
  }

  function Actions({ m }: { m: MeetingMessage }) {
    const mine = m.user_id === currentUserId;
    if (!mine && !canPin) return null;

    return (
      <span className="flex shrink-0 items-center gap-2.5 text-[11.5px] text-text-muted-dark">
        {canPin && !m.reply_to_id && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run(() => togglePinMeetingMessageAction(m.id))}
            className="flex items-center gap-1 hover:text-primary disabled:opacity-50"
          >
            <Pin size={11} />
            {m.is_pinned ? t.unpin : t.pin}
          </button>
        )}
        {(mine || canPin) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t.confirmDelete)) void run(() => deleteMeetingMessageAction(m.id));
            }}
            className="flex items-center gap-1 hover:text-error disabled:opacity-50"
          >
            <Trash2 size={11} />
            {t.delete}
          </button>
        )}
      </span>
    );
  }

  return (
    <section className="flex flex-col rounded-xl border border-border-dark bg-surface-dark p-4">
      <div className="mb-1 flex items-center gap-2">
        <MessagesSquare size={15} className="text-primary" />
        <h2 className="text-[14.5px] font-semibold text-text-primary-dark">{t.title}</h2>
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-muted-dark">{t.liveHint}</p>

      {error && (
        <p className="mb-3 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[12.5px] text-error">
          {error}
        </p>
      )}

      <ol className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <li className="py-6 text-center text-[13px] text-text-muted-dark">{t.empty}</li>
        )}

        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-lg border p-3",
              m.is_pinned ? "border-primary/40 bg-primary/[0.06]" : "border-border-dark"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <Author m={m} />
              <Actions m={m} />
            </div>

            {m.is_pinned === 1 && (
              <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary">
                <Pin size={10} /> {t.pinned}
              </span>
            )}

            <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-secondary-dark">
              {m.body}
            </p>

            {m.replies.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-2 border-s border-border-dark ps-3">
                {m.replies.map((r) => (
                  <li key={r.id}>
                    <div className="flex items-start justify-between gap-3">
                      <Author m={r} />
                      <Actions m={r} />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary-dark">
                      {r.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {replyTo === m.id ? (
              <div className="mt-2.5 flex flex-col gap-2">
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  rows={2}
                  placeholder={t.replyPlaceholder}
                  className="w-full rounded-md border border-border-dark bg-bg-dark px-3 py-2 text-[13px] text-text-primary-dark outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void sendReply(m.id)}
                    className="rounded-full bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? t.sending : t.send}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyDraft("");
                    }}
                    className="text-[12.5px] text-text-muted-dark"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReplyTo(m.id)}
                className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-primary"
              >
                <CornerDownLeft size={11} />
                {t.reply}
              </button>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-end gap-2 border-t border-border-dark pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={t.placeholder}
          className="min-w-0 flex-1 rounded-md border border-border-dark bg-bg-dark px-3 py-2 text-[13.5px] text-text-primary-dark outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={pending || !draft.trim()}
          aria-label={t.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </section>
  );
}
