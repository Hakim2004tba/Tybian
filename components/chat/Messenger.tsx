"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ChatPane, Avatar } from "@/components/chat/ChatPane";
import type { Contact, ThreadMessage } from "@/lib/data/teacher-inbox";

/**
 * The messages screen: contacts on one side, the conversation on the
 * other.
 *
 * ONE LAYOUT, TWO SHAPES. On a desktop both panes are visible at once;
 * on a phone the list IS the screen until a contact is picked, and the
 * conversation then takes the whole screen with a back arrow. That is
 * how every messaging app behaves, and it is why this is one component
 * with a breakpoint rather than two pages — the selected contact must
 * survive the change in width.
 */
export function Messenger({
  contacts,
  messagesByThread,
}: {
  contacts: Contact[];
  /** Pre-loaded on the server: these conversations are short. */
  messagesByThread: Record<string, ThreadMessage[]>;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(
    /* Opens on the first contact on a desktop; a phone starts on the
       list, so nothing is selected until they tap. */
    null
  );

  const keyOf = (c: Contact) => c.threadId ?? `new:${c.courseId ?? "admin"}`;
  const active = contacts.find((c) => keyOf(c) === activeKey) ?? null;

  const time = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit" });

  const list = (
    <ul className="flex flex-col">
      {contacts.map((c) => {
        const key = keyOf(c);
        const on = key === activeKey;
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => setActiveKey(key)}
              className={
                "flex w-full items-center gap-3 px-3.5 py-3 text-start transition " +
                (on ? "bg-primary/[0.07]" : "hover:bg-black/[0.03]")
              }
            >
              <Avatar contact={c} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-text-primary-light">
                    {c.name}
                  </span>
                  {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-text-muted-light">
                  {c.lastMessage ?? c.courseTitle ?? "ابدأ المحادثة"}
                </span>
              </span>
              {c.lastMessageAt && (
                <span className="num shrink-0 text-[11px] text-text-muted-light">
                  {time.format(new Date(c.lastMessageAt))}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-surface-light">
      <div className="grid h-[calc(100vh-190px)] min-h-[460px] lg:grid-cols-[300px_1fr]">
        {/* ---- contacts ---- */}
        <aside
          className={
            "min-h-0 overflow-y-auto border-e border-border-light bg-surface-light " +
            (active ? "hidden lg:block" : "block")
          }
        >
          <h2 className="border-b border-border-light px-4 py-3 text-[14px] font-semibold text-text-primary-light">
            المحادثات
          </h2>
          {list}
        </aside>

        {/* ---- the conversation ---- */}
        <section className={"min-h-0 " + (active ? "block" : "hidden lg:block")}>
          {active ? (
            <ChatPane
              contact={active}
              messages={active.threadId ? messagesByThread[active.threadId] ?? [] : []}
              onBack={() => setActiveKey(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageSquare size={28} className="text-text-muted-light" strokeWidth={1.5} />
              <p className="text-[13.5px] text-text-secondary-light">اختر محادثة للبدء</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
