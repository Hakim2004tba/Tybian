import { FileText, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { LessonResource } from "@/lib/data/learn";

export function ResourcesList({ resources }: { resources: LessonResource[] }) {
  if (resources.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {resources.map((r) => (
        <a key={r.id} href={r.file_url} target="_blank" rel="noopener noreferrer">
          <Card tone="dark" interactive className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-error/15 text-error">
              <FileText size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-primary-dark">
              {r.title}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1.5 text-[12px] font-medium text-primary">
              <Download size={13} />
              تحميل
            </span>
          </Card>
        </a>
      ))}
    </div>
  );
}
