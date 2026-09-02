import { Activity, PlayCircle, CheckCircle2, ClipboardCheck, Star, MessageSquare, LogIn } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth/session";
import { getRecentActivityPage } from "@/lib/data/student-dashboard";
import { Pagination } from "@/components/dashboard/Pagination";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const activityConfig: Record<string, { icon: typeof Activity; label: string }> = {
  login: { icon: LogIn, label: "تسجيل دخول" },
  lesson_view: { icon: PlayCircle, label: "مشاهدة درس" },
  lesson_complete: { icon: CheckCircle2, label: "إكمال درس" },
  course_enroll: { icon: ClipboardCheck, label: "تسجيل في دورة" },
  review_submitted: { icon: Star, label: "إضافة تقييم" },
  comment_submitted: { icon: MessageSquare, label: "إضافة تعليق" },
  question_submitted: { icon: MessageSquare, label: "طرح سؤال" },
};

export async function RecentActivitySection({
  page,
  currentParams,
}: {
  page: number;
  currentParams: Record<string, string | undefined>;
}) {
  const user = await getSessionUser();
  const { items, totalCount, pageSize } = await getRecentActivityPage(user!.id, page);

  return (
    <Card padded={false}>
      <div className="border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[16px]">
          <Activity size={17} />
          النشاط الأخير
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="p-lg text-[13.5px] text-text-muted-light">لا يوجد نشاط مسجَّل بعد.</p>
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
                  <div className="text-[13px]">{config.label}</div>
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
