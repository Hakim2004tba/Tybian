import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { bankReady } from "@/lib/data/qcm-bank";
import { listSessions, bankStats, pickerTopics } from "@/lib/data/qcm-sessions";
import { SessionHub } from "@/components/qcm/SessionHub";

export const dynamic = "force-dynamic";

/**
 * The QCM front door: the student's own sessions, not the catalogue.
 * See components/qcm/SessionHub for why this replaced the subject grid.
 */
export default async function QcmHubPage() {
  const user = await getSessionUser();
  if (!user) notFound();
  if (!(await bankReady())) notFound();

  const [sessions, stats, topics] = await Promise.all([
    listSessions(user.id),
    bankStats(user.id),
    pickerTopics(),
  ]);

  return <SessionHub sessions={sessions} stats={stats} topics={topics} />;
}
