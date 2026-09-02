import { getSessionUser } from "@/lib/auth/session";
import { getWeeklyStudySeconds } from "@/lib/data/study-tools";
import { StudyTimer } from "@/components/dashboard/StudyTimer";

export async function StudyTimerSection() {
  const user = await getSessionUser();
  const weeklySeconds = await getWeeklyStudySeconds(user!.id);
  return <StudyTimer initialWeeklySeconds={weeklySeconds} />;
}
