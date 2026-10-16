import Link from "next/link";
import { ChevronLeft, Library } from "lucide-react";
import { requireRouteAccess } from "@/lib/auth/session";
import { query } from "@/lib/db";
import {
  libraryReady, listFoldersForAdmin, listDocumentsForAdmin, getFolder, folderPath,
} from "@/lib/data/library";
import { LibraryManager } from "@/components/admin/library/LibraryManager";
import { getLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * /admin/library — where the university's material is organised.
 *
 * One route for every level, with the folder in the query string, for
 * the same reason as the student side: going up is a link, not a
 * nested layout per depth.
 *
 * Unlike the student view this shows unpublished folders and documents,
 * which is the point of it — material is uploaded, checked, then made
 * visible.
 */
export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  await requireRouteAccess("/admin");
  const { folder: folderId } = await searchParams;
  const locale = await getLocale();

  /* For the "which course explains this lesson" picker. Published
     courses only — linking a draft would offer the student a door that
     leads nowhere. */
  const courses = await query<{ id: string; title: string }>(
    `SELECT id, title FROM courses WHERE status = 'published' ORDER BY title ASC`
  );

  if (!(await libraryReady())) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text-primary-light">الدروس</h1>
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          شغّل <span className="num">tibyan-db/mysql/09-library.sql</span> في phpMyAdmin أولاً.
        </p>
      </div>
    );
  }

  const [folder, folders, documents, path, years] = await Promise.all([
    folderId ? getFolder(folderId) : Promise.resolve(null),
    listFoldersForAdmin(folderId ?? null),
    folderId ? listDocumentsForAdmin(folderId) : Promise.resolve([]),
    folderId ? folderPath(folderId) : Promise.resolve([]),
    query<{ id: string; name_ar: string; name_en: string | null }>(
      `SELECT id, name_ar, name_en FROM academic_years ORDER BY sort_order ASC`
    ),
  ]);

  const academicYears = years.map((y) => ({
    id: y.id,
    label: locale === "en" ? (y.name_en ?? y.name_ar) : y.name_ar,
  }));

  return (
    <div>
      <header>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <Library size={20} className="text-primary" />
          الدروس
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          دروس الجامعة الرسمية. أنشئ مجلّداً لكل سنة، ثم مجلّدات للمقاييس، وارفع الملفّات بداخلها.
          الطالب يقرأ PDF داخل المنصّة ويظلّل ويكتب ملاحظاته، وتبقى محفوظة في حسابه.
        </p>
      </header>

      {path.length > 0 && (
        <nav className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px]">
          <Link href="/admin/library" className="text-primary hover:underline">
            الجذر
          </Link>
          {path.map((node, i) => (
            <span key={node.id} className="flex items-center gap-1.5">
              <ChevronLeft size={13} className="text-text-muted-light rtl:rotate-180" />
              {i === path.length - 1 ? (
                <span className="font-semibold text-text-primary-light">{node.title}</span>
              ) : (
                <Link href={`/admin/library?folder=${node.id}`} className="text-primary hover:underline">
                  {node.title}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="mt-6">
        <LibraryManager
          folder={folder}
          folders={folders}
          documents={documents}
          academicYears={academicYears}
          courses={courses}
        />
      </div>
    </div>
  );
}
