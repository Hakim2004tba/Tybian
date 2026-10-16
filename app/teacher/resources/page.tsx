import { Paperclip } from "lucide-react";
import { query } from "@/lib/db";
import { getTeacherScope, listLessons, ownsLesson } from "@/lib/data/teacher";
import { libraryFileSize } from "@/lib/library/storage";
import { ResourceManager } from "@/components/teacher/resources/ResourceManager";

export const dynamic = "force-dynamic";

/**
 * /teacher/resources — the attachments under each video.
 *
 * Same shape as the QCM screen: pick a lesson from the ones you own,
 * then work on it. `lesson_resources` existed in the schema from the
 * start and was READ by the lesson page, but nothing in the app could
 * ever create a row — so every course shipped with an empty
 * "attachments" tab. This is the missing half.
 */
export default async function TeacherResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson: requested } = await searchParams;

  const scope = await getTeacherScope();
  if (!scope) return null;

  const lessons = await listLessons(scope);

  /*
    A lesson id in the query string is not permission to touch it.
    Unchecked, ?lesson=<someone-else's-id> would list and edit another
    teacher's attachments.
  */
  const lessonId = requested && (await ownsLesson(scope, requested)) ? requested : undefined;

  const rows = lessonId
    ? await query<{ id: string; title: string; file_url: string }>(
        `SELECT id, title, file_url FROM lesson_resources
          WHERE lesson_id = ? AND deleted_at IS NULL
          ORDER BY sort_order ASC, created_at ASC`,
        [lessonId]
      )
    : [];

  /*
    Sizes come from disk, not from a column — lesson_resources has none,
    and adding one would mean a migration for a number the filesystem
    already knows. A handful of stats per page is cheaper than that.
  */
  const resources = await Promise.all(
    rows.map(async (r) => {
      const bytes = await libraryFileSize(r.file_url);
      return {
        id: r.id,
        title: r.title,
        sizeLabel:
          bytes === null
            ? null
            : bytes >= 1024 * 1024
              ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.max(1, Math.round(bytes / 1024))} KB`,
      };
    })
  );

  const current = lessons.find((l) => l.id === lessonId);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <header>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <Paperclip size={20} className="text-primary" />
          مرفقات الدروس
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          الملفّات التي تظهر تحت كل فيديو — الشرائح، الملخّصات، التمارين.
          يراها الطالب في تبويب «المرفقات» داخل الدرس، ولا تصله إلّا إذا كان
          يملك حقّ مشاهدة ذلك الدرس.
        </p>
      </header>

      <form className="mt-5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-text-primary-light">الدرس</span>
          <select
            name="lesson"
            defaultValue={lessonId ?? ""}
            className="w-full rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px] sm:w-auto sm:min-w-[280px]"
          >
            <option value="">اختر درساً…</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </label>
        <button className="rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-white">
          افتح
        </button>
      </form>

      <div className="mt-6">
        {!lessonId ? (
          <p className="rounded-xl border border-border-light bg-surface-light px-lg py-12 text-center text-[14px] text-text-secondary-light">
            اختر درساً لإدارة مرفقاته.
          </p>
        ) : (
          <>
            <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">
              {current?.label}
            </h2>
            <ResourceManager lessonId={lessonId} resources={resources} />
          </>
        )}
      </div>
    </div>
  );
}
