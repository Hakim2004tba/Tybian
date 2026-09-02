import { Trophy, Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth/session";
import { getStudyLeaderboard } from "@/lib/data/study-tools";
import { cn } from "@/lib/utils";

function formatHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
}

const medalColors = ["text-gold", "text-text-muted-light", "text-[#a56a3a]"];

/**
 * Scoped entirely to students sharing the caller's own academic year —
 * enforced by RLS (study_sessions_same_year_select, 0029), not by a
 * filter in this query. Ranked by this week's study-timer minutes
 * specifically (not general video watch time), per the request.
 */
export async function StudyLeaderboard() {
  const user = await getSessionUser();
  const rows = await getStudyLeaderboard(user!.id);

  if (rows.length === 0) {
    return (
      <Card>
        <h3 className="flex items-center gap-2 text-[15px]">
          <Trophy size={17} />
          لوحة الصدارة
        </h3>
        <p className="mt-2 text-[13px] text-text-muted-light">
          ابدأ مؤقّت الدراسة لتظهر هنا مقارنةً بزملائك في نفس السنة الدراسية.
        </p>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[15px]">
          <Trophy size={17} />
          لوحة الصدارة — هذا الأسبوع
        </h3>
      </div>

      <div className="flex flex-col divide-y divide-border-light">
        {rows.map((row, i) => (
          <div
            key={row.userId}
            className={cn("flex items-center gap-3 p-lg py-3", row.isCurrentUser && "bg-primary/5")}
          >
            <span className={cn("num w-5 shrink-0 text-center text-[13px] font-bold", medalColors[i] ?? "text-text-muted-light")}>
              {i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", row.isCurrentUser && "font-semibold text-primary")}>
              {row.isCurrentUser ? "أنت" : row.fullName}
            </span>
            {row.streakDays > 0 && (
              <span className="num flex items-center gap-1 text-[12px] text-gold">
                <Flame size={12} className="fill-gold" />
                {row.streakDays}
              </span>
            )}
            <span className="num shrink-0 text-[12.5px] font-medium text-text-secondary-light">
              {formatHours(row.weeklySeconds)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
