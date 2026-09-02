import { Bell } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/auth/session";
import { getNotificationsPage } from "@/lib/data/student-dashboard";
import { Pagination } from "@/components/dashboard/Pagination";
import { MarkReadButton } from "@/components/dashboard/MarkReadButton";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export async function NotificationsSection({
  page,
  currentParams,
}: {
  page: number;
  currentParams: Record<string, string | undefined>;
}) {
  const user = await getSessionUser();
  const { items, totalCount, pageSize } = await getNotificationsPage(user!.id, page);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[16px]">
          <Bell size={17} />
          الإشعارات
        </h3>
        {totalCount > 0 && <Badge variant="violet">{totalCount}</Badge>}
      </div>

      {items.length === 0 ? (
        <p className="p-lg text-[13.5px] text-text-muted-light">لا توجد إشعارات بعد.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border-light">
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-lg py-3.5">
              {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              <div className={`min-w-0 flex-1 ${n.is_read ? "opacity-60" : ""}`}>
                <div className="text-[13.5px] font-medium">{n.title}</div>
                {n.body && <div className="mt-0.5 text-[12.5px] text-text-secondary-light">{n.body}</div>}
                <div className="num mt-1 text-[11px] text-text-muted-light">
                  {dateFormatter.format(new Date(n.created_at))}
                </div>
              </div>
              {!n.is_read && <MarkReadButton notificationId={n.id} />}
            </div>
          ))}
        </div>
      )}

      <div className="px-lg pb-4">
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          paramName="notifPage"
          basePath="/dashboard"
          currentParams={currentParams}
        />
      </div>
    </Card>
  );
}
