"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MessageSquare, Send, ChevronRight } from "lucide-react";
import { replyThreadAction, type InboxState } from "@/lib/actions/teacher-inbox";
import type { AdminConversation, ThreadMessage } from "@/lib/data/teacher-inbox";

const initial: InboxState = { error: null };

/**
 * The platform's side of its conversations with students.
 *
 * The same two-pane shape the student sees, for the same reason: this
 * is a chat, and a chat that looks like a ticket queue gets answered
 * like one. Replies go through replyThreadAction — the same path the
 * teacher uses, so "answered" means one thing everywhere.
 */
export function AdminMessenger({
  conversations,
  messagesByThread,
}: {
  conversations: AdminConversation[];
  messagesByThread: Record<string, ThreadMessage[]>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = conversations.find((c) => c.threadId === activeId) ?? null;

  const day = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit" });

  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-white">
      <div className="grid h-[calc(100vh-220px)] min-h-[440px] lg:grid-cols-[300px_1fr]">
        <aside
          className={
            "min-h-0 overflow-y-auto border-e border-border-light " +
            (active ? "hidden lg:block" : "block")
          }
        >
          <h2 className="border-b border-border-light px-4 py-3 text-[14px] font-semibold text-text-primary-light">
            المحادثات
          </h2>

          {conversations.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-text-muted-light">
              لا توجد محادثات. ابدأ واحدة من صفحة أيّ طالب.
            </p>
          ) : (
            <ul className="flex flex-col">
              {conversations.map((c) => (
                <li key={c.threadId}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.threadId)}
                    className={
                      "flex w-full items-center gap-3 px-3.5 py-3 text-start transition " +
                      (c.threadId === activeId ? "bg-primary/[0.07]" : "hover:bg-black/[0.03]")
                    }
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/10">
                      {c.avatarUrl ? (
                        <Image src={c.avatarUrl} alt="" fill sizes="40px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[14px] font-bold text-primary">
                          {c.studentName.trim().charAt(0)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-text-primary-light">
                          {c.studentName}
                        </span>
                        {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-text-muted-light">
                        {c.lastMessage ?? "—"}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[11px] text-text-muted-light">
                      {day.format(new Date(c.lastMessageAt))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={"min-h-0 " + (active ? "block" : "hidden lg:block")}>
          {active ? (
            <AdminChat
              key={active.threadId}
              conversation={active}
              messages={messagesByThread[active.threadId] ?? []}
              onBack={() => setActiveId(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageSquare size={28} className="text-text-muted-light" strokeWidth={1.5} />
              <p className="text-[13.5px] text-text-secondary-light">اختر محادثة</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AdminChat({
  conversation,
  messages,
  onBack,
}: {
  conversation: AdminConversation;
  messages: ThreadMessage[];
  onBack: () => void;
}) {
  const action = replyThreadAction.bind(null, conversation.threadId);
  const [state, formAction] = useActionState(action, initial);
  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const time = new Intl.DateTimeFormat("ar-DZ", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border-light px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="رجوع"
          className="-ms-1 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary-light lg:hidden"
        >
          <ChevronRight size={18} className="rtl:rotate-180" />
        </button>
        <p className="truncate text-[14px] font-semibold text-text-primary-light">
          {conversation.studentName}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg-light px-4 py-4">
        <ul className="flex flex-col gap-2">
          {messages.map((m) => (
            <li key={m.id} className={m.mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[80%] rounded-2xl px-3.5 py-2 " +
                  (m.mine
                    ? "rounded-se-md bg-primary text-white"
                    : "rounded-ss-md bg-white text-text-primary-light shadow-[0_1px_2px_rgba(23,15,46,0.06)]")
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
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </div>

      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd);
          formRef.current?.reset();
        }}
        className="flex items-end gap-2 border-t border-border-light px-3 py-2.5"
      >
        <textarea
          name="body"
          required
          rows={1}
          placeholder="اكتب ردّك…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-[140px] min-h-[40px] flex-1 resize-none rounded-2xl border border-border-light bg-bg-light px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          aria-label="إرسال"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
        >
          <Send size={16} className="rtl:-scale-x-100" />
        </button>
      </form>

      {state.error && <p className="px-4 pb-2 text-[12px] text-error">{state.error}</p>}
    </div>
  );
}
