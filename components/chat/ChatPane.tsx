"use client";

import { useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import { Send, ShieldCheck, ChevronRight } from "lucide-react";
import { sendMessageAction, type ChatState } from "@/lib/actions/chat";
import type { Contact, ThreadMessage } from "@/lib/data/teacher-inbox";

const initial: ChatState = { error: null };

/**
 * One conversation — the right-hand pane on a desktop, the whole
 * screen on a phone.
 *
 * Styled as a chat rather than a form: bubbles, the student's own on
 * the trailing side, the composer pinned to the bottom. The point of
 * the rework was that the old thread list "felt mixed up"; what made
 * it feel that way was that it looked like a support ticket.
 */
export function ChatPane({
  contact,
  messages,
  onBack,
}: {
  contact: Contact;
  messages: ThreadMessage[];
  /** Phone only: returns to the contact list. */
  onBack?: () => void;
}) {
  const action = sendMessageAction.bind(null, contact.courseId);
  const [state, formAction] = useActionState(action, initial);

  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /* Pinned to the newest message, the way every chat behaves. */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const time = new Intl.DateTimeFormat("ar-DZ", { hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit" });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- who you are talking to ---- */}
      <header className="flex items-center gap-3 border-b border-border-light bg-surface-light px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="-ms-1 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary-light lg:hidden"
          >
            <ChevronRight size={18} className="rtl:rotate-180" />
          </button>
        )}

        <Avatar contact={contact} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-text-primary-light">
            {contact.name}
          </p>
          {contact.courseTitle && (
            <p className="truncate text-[12px] text-text-muted-light">{contact.courseTitle}</p>
          )}
        </div>
      </header>

      {/* ---- the conversation ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-academy-lavender px-4 py-4">
        {messages.length === 0 ? (
          <p className="mx-auto mt-10 max-w-sm rounded-xl bg-surface-light px-4 py-6 text-center text-[13px] leading-relaxed text-text-secondary-light">
            {contact.kind === "admin"
              ? "اكتب إلى إدارة تبيان — أيّ سؤال عن حسابك أو اشتراكك."
              : `اكتب إلى ${contact.name} عن ${contact.courseTitle ?? "الدورة"}.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay =
                !prev ||
                new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              return (
                <li key={m.id}>
                  {newDay && (
                    <p className="num my-3 text-center text-[11px] text-text-muted-light">
                      {day.format(new Date(m.createdAt))}
                    </p>
                  )}
                  <div className={m.mine ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-3.5 py-2 shadow-[0_1px_2px_rgba(23,15,46,0.06)] " +
                        (m.mine
                          ? "rounded-se-md bg-primary text-white"
                          : "rounded-ss-md bg-surface-light text-text-primary-light")
                      }
                    >
                      <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">
                        {m.body}
                      </p>
                      <p
                        className={
                          "num mt-0.5 text-[10.5px] " +
                          (m.mine ? "text-white/60" : "text-text-muted-light")
                        }
                      >
                        {time.format(new Date(m.createdAt))}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {/* ---- the composer ---- */}
      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd);
          formRef.current?.reset();
        }}
        className="flex items-end gap-2 border-t border-border-light bg-surface-light px-3 py-2.5"
      >
        <textarea
          name="body"
          required
          rows={1}
          placeholder="اكتب رسالة…"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter makes a new line — what every
               chat does, and what fingers expect. */
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-[140px] min-h-[40px] flex-1 resize-none rounded-2xl border border-border-light bg-bg-light px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-primary"
        />
        <button
          type="submit"
          aria-label="إرسال"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
        >
          <Send size={16} className="rtl:-scale-x-100" />
        </button>
      </form>

      {state.error && (
        <p className="bg-surface-light px-4 pb-2 text-[12px] text-error">{state.error}</p>
      )}
    </div>
  );
}

export function Avatar({ contact, size = 40 }: { contact: Contact; size?: number }) {
  if (contact.kind === "admin") {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white"
        style={{ width: size, height: size }}
      >
        <ShieldCheck size={size * 0.45} />
      </span>
    );
  }

  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full bg-primary/10"
      style={{ width: size, height: size }}
    >
      {contact.avatarUrl ? (
        <Image src={contact.avatarUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[14px] font-bold text-primary">
          {contact.name.trim().charAt(0)}
        </span>
      )}
    </span>
  );
}
