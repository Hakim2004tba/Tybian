import { MessageSquare } from "lucide-react";
import { requireRouteAccess, getSessionUser } from "@/lib/auth/session";
import {
  adminInbox, inboxReady, threadFor, type ThreadMessage,
} from "@/lib/data/teacher-inbox";
import { AdminMessenger } from "@/components/chat/AdminMessenger";

export const dynamic = "force-dynamic";

/**
 * Every conversation the platform has with a student, in one place.
 *
 * The per-student page shows that student's threads, which is the
 * right place when you are already looking at them — and the wrong
 * place for noticing that somebody wrote three days ago. Unanswered
 * first here, so the queue is the page.
 */
export default async function AdminMessagesPage() {
  await requireRouteAccess("/admin");
  const user = await getSessionUser();

  if (!(await inboxReady())) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text-primary-light">الرسائل</h1>
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          شغّل <span className="num">21-teacher-inbox.sql</span> ثمّ{" "}
          <span className="num">23-admin-chat.sql</span> في phpMyAdmin أولاً.
        </p>
      </div>
    );
  }

  const conversations = await adminInbox();

  const messagesByThread: Record<string, ThreadMessage[]> = {};
  for (const c of conversations) {
    const data = user ? await threadFor(c.threadId, user.id) : null;
    if (data) messagesByThread[c.threadId] = data.messages;
  }

  const waiting = conversations.filter((c) => c.unread).length;

  return (
    <div>
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <MessageSquare size={20} className="text-primary" />
          الرسائل
          {waiting > 0 && (
            <span className="num rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-semibold text-white">
              {waiting}
            </span>
          )}
        </h1>
        <p className="mt-1 text-[13.5px] text-text-secondary-light">
          المحادثات مع الطلبة. ما ينتظر ردّاً في الأعلى.
        </p>
      </header>

      <AdminMessenger conversations={conversations} messagesByThread={messagesByThread} />
    </div>
  );
}
