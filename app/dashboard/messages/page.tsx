import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  inboxReady, studentContacts, threadFor, type ThreadMessage,
} from "@/lib/data/teacher-inbox";
import { Messenger } from "@/components/chat/Messenger";

export const dynamic = "force-dynamic";

/**
 * The student's messages — the platform, and the teacher of every
 * course they are enrolled in.
 *
 * Replaces /dashboard/questions, which listed threads that already
 * existed and gave no way to start one. The contact comes first here;
 * the thread is created by the first message and the student never
 * has to think about it.
 */
export default async function MessagesPage() {
  const user = await getSessionUser();
  if (!user) notFound();
  if (!(await inboxReady())) notFound();

  const contacts = await studentContacts(user.id);

  /*
    Every conversation loaded up front. These are a handful of threads
    with a few messages each — far cheaper than a request per tap, and
    it makes switching contacts instant.
  */
  const messagesByThread: Record<string, ThreadMessage[]> = {};
  for (const contact of contacts) {
    if (!contact.threadId) continue;
    const data = await threadFor(contact.threadId, user.id);
    if (data) messagesByThread[contact.threadId] = data.messages;
  }

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="mb-4 text-[22px] font-bold text-text-primary-light">الرسائل</h1>
      <Messenger contacts={contacts} messagesByThread={messagesByThread} />
    </div>
  );
}
