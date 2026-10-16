import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import {
  visibleDocument, listHighlights, getNote, listBookmarks, getProgress, folderPath, linkedCourse,
} from "@/lib/data/library";
import { DocumentReader } from "@/components/library/DocumentReader";
import { CourseLinkCard } from "@/components/library/CourseLinkCard";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * One document, open.
 *
 * The server does the reading of who-may-see-what and hands the client
 * component only what it needs: a URL to the authenticated file route
 * and the student's own marks. The file itself never passes through
 * this page.
 *
 * The reader is loaded only for PDFs. Every other format renders a card
 * with a download — see kindFor() in lib/library/storage.ts for why
 * pretending to render a PPTX would be worse than saying plainly that
 * it downloads.
 */
export default async function LibraryDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const { dict } = await getDictionary();
  const t = dict.library;

  const user = await getSessionUser();
  if (!user) notFound();

  const profile = await queryOne<{ academic_year_id: string | null }>(
    `SELECT academic_year_id FROM profiles WHERE id = ?`,
    [user.id]
  );

  const doc = await visibleDocument(
    documentId,
    profile?.academic_year_id ?? null,
    user.role === "admin"
  );
  if (!doc) notFound();

  const [highlights, note, bookmarks, lastPage, path] = await Promise.all([
    listHighlights(documentId, user.id),
    getNote(documentId, user.id),
    listBookmarks(documentId, user.id),
    getProgress(documentId, user.id),
    folderPath(doc.folderId),
  ]);

  /* The course whose videos explain this document, when one is linked.
     Null until migration 15 is run, which is why it is asked for on its
     own rather than joined into the document query. */
  const course = await linkedCourse(documentId);

  const fileUrl = `/api/library/${documentId}/file`;
  const backHref = `/dashboard/lessons${doc.folderId ? `?folder=${doc.folderId}` : ""}`;

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <Link href={backHref} className="text-primary hover:underline">
          {t.backToLibrary}
        </Link>
        {path.map((node) => (
          <span key={node.id} className="flex items-center gap-1.5">
            <ChevronLeft size={13} className="text-text-muted-light rtl:rotate-180" />
            <Link href={`/dashboard/lessons?folder=${node.id}`} className="text-primary hover:underline">
              {node.title}
            </Link>
          </span>
        ))}
      </nav>

      <header className="mt-3">
        <h1 className="text-[20px] font-bold text-text-primary-light">{doc.title}</h1>
        {doc.description && (
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
            {doc.description}
          </p>
        )}
      </header>

      {/* Straight from the lecture to the video that explains it.

          ABOVE THE READER, not below it. Under the document it sat
          past a full-height PDF, so the only students who ever saw it
          were the ones who scrolled past the thing they came to read —
          which is to say, nobody looking for the video. */}
      {course && (
        <CourseLinkCard
          course={course}
          labels={{
            watch: t.watchCourse,
            related: t.relatedCourse,
            lessons: t.courseLessons,
            minutes: t.courseMinutes,
          }}
        />
      )}

      <div className="mt-5">
        {doc.kind === "pdf" ? (
          <DocumentReader
            documentId={documentId}
            fileUrl={fileUrl}
            title={doc.title}
            initialHighlights={highlights}
            initialNote={note}
            initialBookmarks={bookmarks}
            initialPage={lastPage}
            knownPageCount={doc.pageCount}
          />
        ) : doc.kind === "image" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={fileUrl}
            alt={doc.title}
            className="mx-auto max-w-full rounded-xl border border-border-light bg-white"
          />
        ) : (
          <div className="rounded-xl border border-border-light bg-white p-8 text-center">
            <p className="text-[14px] leading-relaxed text-text-secondary-light">{t.downloadOnly}</p>
            {doc.mimeType.includes("presentation") && (
              <p className="mt-2 text-[12.5px] text-text-muted-light">{t.pptxHint}</p>
            )}
            <a
              href={`${fileUrl}?download=1`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-white"
            >
              <Download size={15} />
              {t.download}
            </a>
            <p className="num mt-3 text-[12px] text-text-muted-light">{doc.originalName}</p>
          </div>
        )}

      </div>
    </div>
  );
}
