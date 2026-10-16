"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { replyThreadAction, closeThreadAction, type InboxState } from "@/lib/actions/teacher-inbox";
import type { ThreadMessage } from "@/lib/data/teacher-inbox";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initial: InboxState = { error: null };

/**
 * One private conversation, for whichever side is reading it.
 *
 * Both sides get the same component because both do the same thing —
 * read what was said and answer. A second, teacher-flavoured copy
 * would drift the moment either one changed.
 */
export function ThreadView({
  threadId,
  messages,
  status,
  closable = true,
}: {
  threadId: string;
  messages: ThreadMessage[];
  status: "open" | "answered" | "closed";
  closable?: boolean;
}) {
  const reply = replyThreadAction.bind(null, threadId);
  const [state, action] = useActionState(reply, initial);

  const time = new Intl.DateTimeFormat("ar-DZ", { dateStyle: "short", timeStyle: "short" });

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {messages.map((m) => (
          <li key={m.id} className={m.mine ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 " +
                (m.mine
                  ? "rounded-se-sm bg-primary text-white"
                  : "rounded-ss-sm border border-border-light bg-surface-light text-text-primary-light")
              }
            >
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">
                {m.body}
              </p>
              <p
                className={
                  "num mt-1 text-[11px] " + (m.mine ? "text-white/60" : "text-text-muted-light")
                }
              >
                {m.authorName} · {time.format(new Date(m.createdAt))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {status === "closed" ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-border-light bg-bg-light px-3.5 py-3 text-[13px] text-text-secondary-light">
          <CheckCircle2 size={15} className="text-success" />
          أُغلق هذا السؤال.
        </p>
      ) : (
        <>
          <form action={action} className="mt-5">
            <textarea
              name="body"
              required
              rows={3}
              placeholder="اكتب ردّك…"
              className="w-full resize-y rounded-xl border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-primary"
            />
            {state.error && <p className="mt-1.5 text-[12.5px] text-error">{state.error}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SubmitButton className="!w-fit !px-4 !py-2 !text-[13px]">
                <Send size={14} /> إرسال
              </SubmitButton>

              {closable && (
                <button
                  type="button"
                  onClick={() => void closeThreadAction(threadId)}
                  className="rounded-xl border border-border-light px-3.5 py-2 text-[13px] text-text-secondary-light transition hover:border-primary/40 hover:text-primary"
                >
                  إغلاق السؤال
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
