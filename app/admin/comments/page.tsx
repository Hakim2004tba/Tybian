import { Badge } from "@/components/ui/Badge";
import { getOpenReports } from "@/lib/data/admin-moderation";
import { ModerationQueue } from "@/components/admin/moderation/ModerationQueue";

export default async function AdminCommentsPage() {
  const reports = await getOpenReports();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge variant="violet">إدارة المحتوى</Badge>
        <h1 className="mt-3 text-2xl">البلاغات والتعليقات</h1>
        <p className="mt-1 text-text-secondary-light">
          <span className="num">{reports.length}</span> بلاغ قيد المراجعة
        </p>
      </div>

      <ModerationQueue reports={reports} />
    </div>
  );
}
