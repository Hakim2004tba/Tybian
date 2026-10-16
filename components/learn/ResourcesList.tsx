import { FileText, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { LessonResource } from "@/lib/data/learn";
import { getDictionary } from "@/lib/i18n/locale";

export async function ResourcesList({
  resources,
  lessonId,
}: {
  resources: LessonResource[];
  lessonId: string;
}) {
  const { dict } = await getDictionary();
  if (resources.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {resources.map((r) => (
        /*
          Through the authenticated route, not the stored path.

          file_url is a path inside the PRIVATE storage directory — it
          is not reachable by the browser and must not be, because an
          attachment is the paid part of a course. The route checks the
          same access rule the video does before streaming a byte. See
          app/api/lessons/[lessonId]/resources/[resourceId]/route.ts.
        */
        <a
          key={r.id}
          href={`/api/lessons/${lessonId}/resources/${r.id}?download=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card tone="dark" interactive className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-error/15 text-error">
              <FileText size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-primary-dark">
              {r.title}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1.5 text-[12px] font-medium text-primary">
              <Download size={13} />
              {dict.learn.download}
            </span>
          </Card>
        </a>
      ))}
    </div>
  );
}
