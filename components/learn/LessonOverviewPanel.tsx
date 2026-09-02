import { User, BookOpen, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";

function formatMinutes(seconds: number) {
  if (!seconds) return "—";
  return `${Math.round(seconds / 60)} دقيقة`;
}

export function LessonOverviewPanel({
  description,
  teacherName,
  courseTitle,
  durationSeconds,
}: {
  description: string | null;
  teacherName: string | null;
  courseTitle: string;
  durationSeconds: number;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
      <div>
        <h3 className="mb-2 text-[15px] font-semibold text-text-primary-dark">عن هذا الدرس</h3>
        {description ? (
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-text-secondary-dark">
            {description}
          </p>
        ) : (
          <p className="text-[13.5px] text-text-muted-dark">لا يوجد وصف لهذا الدرس بعد.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <InfoRow icon={User} label="الأستاذ" value={teacherName ?? "غير محدد"} />
        <InfoRow icon={BookOpen} label="الدورة" value={courseTitle} />
        <InfoRow icon={Clock} label="المدة" value={formatMinutes(durationSeconds)} />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <Card tone="dark" className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[11.5px] text-text-muted-dark">{label}</div>
        <div className="truncate text-[13.5px] font-medium text-text-primary-dark">{value}</div>
      </div>
    </Card>
  );
}
