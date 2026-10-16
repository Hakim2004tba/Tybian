import { Activity, PlayCircle, CheckCircle2, ClipboardCheck, Star, MessageSquare, LogIn } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth/session";
import { getRecentActivityPage } from "@/lib/data/student-dashboard";
import { Pagination } from "@/components/dashboard/Pagination";
import { getDictionary } from "@/lib/i18n/locale";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/* The icon belongs to the activity type; the wording belongs to the
   dictionary, so only the key is stored here. */
type ActivityKey =
  | "signedIn"
  | "lessonWatched"
  | "lessonCompleted"
  | "enrolled"
  | "reviewAdded"
  | "commentAdded"
  | "askedQuestion";

const activityConfig: Record<string, { icon: typeof Activity; key: ActivityKey }> = {
  login: { icon: LogIn, key: "signedIn" },
  lesson_view: { icon: PlayCircle, key: "lessonWatched" },
  lesson_complete: { icon: CheckCircle2, key: "lessonCompleted" },
  course_enroll: { icon: ClipboardCheck, key: "enrolled" },
  review_submitted: { icon: Star, key: "reviewAdded" },
  comment_submitted: { icon: MessageSquare, key: "commentAdded" },
  question_submitted: { icon: MessageSquare, key: "askedQuestion" },
};

export async function RecentActivitySection({
  page,
  currentParams,
}: {
  page: number;
  currentParams: Record<string, string | undefined>;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const { items, totalCount, pageSize } = await getRecentActivityPage(user!.id, page);

  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[16px]">
          <Activity size={17} />
          {t.activity.title}
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="p-lg text-[13.5px] text-text-muted-light">{t.activity.empty}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border-light">
          {items.map((a) => {
            const config = activityConfig[a.activity_type] ?? { icon: Activity, label: a.activity_type };
            const Icon = config.icon;
            return (
              <div key={a.id} className="flex items-center gap-3 p-lg py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px]">{t.activity[config.key]}</div>
                </div>
                <span className="num shrink-0 text-[11px] text-text-muted-light">
                  {dateFormatter.format(new Date(a.created_at))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-lg pb-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          paramName="activityPage"
          basePath="/dashboard"
          currentParams={currentParams}
        />
      </div>
    </Card>
  );
}
