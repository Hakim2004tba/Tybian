import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft, Folder, FileText, Search, BookOpen, Highlighter, Clock,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import {
  libraryReady, listFoldersForStudent, listDocumentsWithProgress, folderPath,
  recentDocuments, searchDocumentsForStudent, getFolder,
  type StudentDocument,
} from "@/lib/data/library";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * "الدروس" — the library index.
 *
 * ONE route for every depth, with the folder in the query string
 * (?folder=…), rather than a nested route per level. A tree here is
 * arbitrarily deep — Semester 1 → Anatomy → Osteology and further — and
 * a route segment per level would mean a folder that cannot be created
 * without a code change.
 *
 * Three ways in, because three different students arrive here:
 *   - the one continuing yesterday's reading (recent, at the top)
 *   - the one who knows the word but not the folder (search)
 *   - the one browsing the tree (folders and files)
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string }>;
}) {
  const { folder: folderId, q } = await searchParams;
  const { dict } = await getDictionary();
  const t = dict.library;

  const user = await getSessionUser();
  if (!user) notFound();

  if (!(await libraryReady())) {
    return (
      <div className="px-md py-lg md:px-xl md:py-xl">
        <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          {t.notInstalled}
        </p>
      </div>
    );
  }

  const profile = await queryOne<{ academic_year_id: string | null }>(
    `SELECT academic_year_id FROM profiles WHERE id = ?`,
    [user.id]
  );
  const yearId = profile?.academic_year_id ?? null;

  const term = (q ?? "").trim();
  const searching = term.length >= 2;

  /* A search spans the whole library, so it ignores the folder the
     student happens to be standing in. */
  const results = searching ? await searchDocumentsForStudent(yearId, user.id, term) : [];

  const [folders, documents, path, current, recent] = await Promise.all([
    searching ? Promise.resolve([]) : listFoldersForStudent(yearId, folderId ?? null),
    searching || !folderId ? Promise.resolve([]) : listDocumentsWithProgress(folderId, user.id),
    folderId ? folderPath(folderId) : Promise.resolve([]),
    folderId ? getFolder(folderId) : Promise.resolve(null),
    searching || folderId ? Promise.resolve([]) : recentDocuments(user.id, 4),
  ]);

  const parentHref = (() => {
    if (!path.length) return "/dashboard/lessons";
    const parent = path[path.length - 2];
    return parent ? `/dashboard/lessons?folder=${parent.id}` : "/dashboard/lessons";
  })();

  return (
    /* Same gutters as the document page — a page of the dashboard, not
       a full-bleed panel. Without them the heading ran under the rail. */
    <div className="px-md py-lg md:px-xl md:py-xl">
      <header>
        <h1 className="text-[22px] font-bold text-text-primary-light">
          {current ? current.title : t.title}
        </h1>
        {!folderId && !searching && (
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
            {t.subtitle}
          </p>
        )}
      </header>

      {/* ---------- search ---------- */}
      <form action="/dashboard/lessons" className="mt-5">
        <div className="relative max-w-xl">
          <Search
            size={16}
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-text-muted-light"
          />
          <input
            name="q"
            defaultValue={term}
            placeholder={t.searchLibrary}
            className="w-full rounded-xl border border-border-light bg-surface-light py-2.5 ps-10 pe-3.5 text-[13.5px] outline-none transition focus:border-primary"
          />
        </div>
      </form>

      {/* ---------- breadcrumb ---------- */}
      {!searching && path.length > 0 && (
        <nav className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px] text-text-secondary-light">
          <Link href="/dashboard/lessons" className="hover:text-primary">
            {t.title}
          </Link>
          {path.map((node, i) => (
            <span key={node.id} className="flex items-center gap-1.5">
              <ChevronLeft size={14} className="rtl:rotate-180" />
              {i === path.length - 1 ? (
                <span className="text-text-primary-light">{node.title}</span>
              ) : (
                <Link href={`/dashboard/lessons?folder=${node.id}`} className="hover:text-primary">
                  {node.title}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ---------- continue reading ---------- */}
      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-text-primary-light">
            <Clock size={15} className="text-primary" />
            {t.continueReading}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/lessons/${r.id}`}
                className="rounded-xl border border-border-light bg-surface-light p-3.5 transition hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(23,15,46,0.5)]"
              >
                <span className="block truncate text-[13.5px] font-semibold text-text-primary-light">
                  {r.title}
                </span>
                <span className="mt-1 block truncate text-[12px] text-text-muted-light">
                  {r.folderTitle}
                </span>
                <span className="num mt-2 block text-[12px] text-primary">
                  {t.page} {r.lastPage}
                  {r.pageCount ? ` / ${r.pageCount}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- search results ---------- */}
      {searching && (
        <section className="mt-6">
          {results.length === 0 ? (
            <p className="rounded-xl border border-border-light bg-surface-light px-4 py-6 text-center text-[13.5px] text-text-secondary-light">
              {t.noResults}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((d) => (
                <DocumentRow key={d.id} doc={d} labels={t} showFolder />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---------- folders ---------- */}
      {!searching && folders.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[14px] font-semibold text-text-primary-light">{t.folders}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/lessons?folder=${f.id}`}
                className="flex items-center gap-3 rounded-xl border border-border-light bg-surface-light p-3.5 transition hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(23,15,46,0.5)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Folder size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text-primary-light">
                    {f.title}
                  </span>
                  <span className="num mt-0.5 block text-[12px] text-text-muted-light">
                    {f.childCount > 0 && `${f.childCount} ${t.folders}`}
                    {f.childCount > 0 && f.documentCount > 0 && " · "}
                    {f.documentCount > 0 && `${f.documentCount} ${t.documents}`}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- documents ---------- */}
      {!searching && documents.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[14px] font-semibold text-text-primary-light">
            {t.documents}
          </h2>
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} labels={t} />
            ))}
          </ul>
        </section>
      )}

      {/* ---------- nothing here ---------- */}
      {!searching && folders.length === 0 && documents.length === 0 && recent.length === 0 && (
        <p className="mt-6 rounded-xl border border-border-light bg-surface-light px-4 py-8 text-center text-[13.5px] text-text-secondary-light">
          {t.empty}
        </p>
      )}

      {!searching && folderId && (
        <Link
          href={parentHref}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-text-secondary-light hover:text-primary"
        >
          <ChevronLeft size={15} className="rtl:rotate-180" />
          {t.title}
        </Link>
      )}
    </div>
  );
}

/** One file in a list, carrying what the student left on it. */
function DocumentRow({
  doc,
  labels,
  showFolder,
}: {
  doc: StudentDocument;
  labels: { open: string; page: string; pages: string; marksShort: string };
  showFolder?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/dashboard/lessons/${doc.id}`}
        className="flex items-center gap-3 rounded-xl border border-border-light bg-surface-light p-3.5 transition hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(23,15,46,0.5)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-academy-lavender text-primary">
          {doc.kind === "pdf" ? <BookOpen size={18} /> : <FileText size={18} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-text-primary-light">
            {doc.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-text-muted-light">
            {showFolder && <span className="truncate">{doc.folderTitle}</span>}
            {doc.pageCount && (
              <span className="num">
                {doc.pageCount} {labels.pages}
              </span>
            )}
            {doc.lastPage && (
              <span className="num text-primary">
                {labels.page} {doc.lastPage}
              </span>
            )}
            {doc.highlightCount > 0 && (
              <span className="num flex items-center gap-1">
                <Highlighter size={12} />
                {doc.highlightCount} {labels.marksShort}
              </span>
            )}
          </span>
        </span>

        <span className="shrink-0 text-[12.5px] font-semibold text-primary">{labels.open}</span>
      </Link>
    </li>
  );
}
