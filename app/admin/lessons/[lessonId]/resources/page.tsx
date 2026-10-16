import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Paperclip } from "lucide-react";
import { requireRouteAccess } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/db";
import { libraryFileSize } from "@/lib/library/storage";
import { ResourceManager } from "@/components/teacher/resources/ResourceManager";

export const dynamic = "force-dynamic";

/**
 * The admin's way in to a lesson's attachments.
 *
 * The teacher has /teacher/resources; an admin passes that tier too and
 * could use it, but being sent to a screen headed "مساحة الأستاذ" to
 * manage the platform is the kind of seam that makes a back office feel
 * borrowed. Same component, same upload route, same actions — only the
 * surrounding chrome and the entry point differ.
 *
 * The write path is shared and already correct for both: the upload
 * route and the edit actions authorise through getTeacherScope(), which
 * returns every course for an admin and only their own for a teacher.
 */
export default async function AdminLessonResourcesPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  await requireRouteAccess("/admin");
  const { lessonId } = await params;

  const lesson = await queryOne<{ title: string; course_title: string | null }>(
    `SELECT l.title, c.title AS course_title
       FROM lessons l
       LEFT JOIN course_sections s ON s.id = l.section_id
       LEFT JOIN courses c         ON c.id = s.course_id
      WHERE l.id = ? AND l.deleted_at IS NULL`,
    [lessonId]
  );
  if (!lesson) notFound();

  const rows = await query<{ id: string; title: string; file_url: string }>(
    `SELECT id, title, file_url FROM lesson_resources
      WHERE lesson_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC`,
    [lessonId]
  );

  /* Sizes from disk — lesson_resources has no size column, and adding
     one would be a migration for a number the filesystem already knows. */
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

  return (
    <div>
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <Link href="/admin/lessons" className="text-primary hover:underline">
          كل الدروس
        </Link>
        <ChevronLeft size={13} className="text-text-muted-light rtl:rotate-180" />
        <span className="font-semibold text-text-primary-light">{lesson.title}</span>
      </nav>

      <header className="mt-3">
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <Paperclip size={20} className="text-primary" />
          مرفقات الدرس
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          {lesson.course_title ? `${lesson.course_title} — ` : ""}
          الملفّات التي تظهر تحت الفيديو في تبويب «المرفقات»: ملفّ الدرس،
          الملخّص، التمارين. لا تصل الطالب إلّا إذا كان يملك حقّ مشاهدة هذا الدرس.
        </p>
      </header>

      <div className="mt-6">
        <ResourceManager lessonId={lessonId} resources={resources} />
      </div>
    </div>
  );
}
