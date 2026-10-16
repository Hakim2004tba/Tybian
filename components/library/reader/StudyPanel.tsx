"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, StickyNote, Highlighter, Trash2, X, Bookmark } from "lucide-react";
import type { Highlight } from "@/lib/data/library";
import type { PdfDocument } from "@/components/library/pdf-engine";
import { MARKERS, markerFor } from "@/lib/library/markers";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export type PanelTab = "notes" | "search" | "notebook";

const SWATCH: Record<Highlight["color"], string> = {
  yellow: "bg-[#FDE047]",
  green: "bg-[#86EFAC]",
  blue: "bg-[#93C5FD]",
  pink: "bg-[#F9A8D4]",
};

/**
 * Everything the student has written, and the way back to where they
 * wrote it.
 *
 * NOTES ARE GROUPED BY PAGE and every one is a link. A note that does
 * not take you back to its sentence is a note you have to go and find,
 * which is most of the reason notes go unread.
 *
 * The panel is one component used in three places — a column on
 * desktop, a resizable column on a landscape tablet, a bottom sheet on
 * a phone. Only the frame around it changes; what is inside must not,
 * or the student learns it twice.
 */
export function StudyPanel({
  tab,
  onTab,
  doc,
  highlights,
  bookmarks,
  notebook,
  onNotebook,
  onGo,
  onRecolour,
  onDelete,
  onSetNote,
  onRemoveBookmark,
  onClose,
}: {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  doc: PdfDocument | null;
  highlights: Highlight[];
  bookmarks: { id: string; page: number; label: string | null }[];
  notebook: string;
  onNotebook: (value: string) => void;
  onGo: (page: number) => void;
  onRecolour: (id: string, colour: Highlight["color"]) => void;
  onDelete: (id: string) => void;
  onSetNote: (id: string, value: string) => void;
  onRemoveBookmark: (page: number) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const labels = t.library;
  const [query, setQuery] = useState("");

  /* Grouped by page, in reading order — the order they will be revised
     in, which is not the order they were written in. */
  const byPage = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const groups = new Map<number, Highlight[]>();

    for (const mark of highlights) {
      if (needle) {
        const haystack = `${mark.quotedText ?? ""} ${mark.note ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
      }
      groups.set(mark.page, [...(groups.get(mark.page) ?? []), mark]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [highlights, query]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-light">
      <div className="flex shrink-0 items-center gap-1 border-b border-border-light px-2 py-1.5">
        <Tab active={tab === "notes"} onClick={() => onTab("notes")} icon={<Highlighter size={14} />}>
          {labels.marks}
        </Tab>
        <Tab active={tab === "notebook"} onClick={() => onTab("notebook")} icon={<StickyNote size={14} />}>
          {labels.notebook}
        </Tab>
        <Tab active={tab === "search"} onClick={() => onTab("search")} icon={<Search size={14} />}>
          {labels.search}
        </Tab>
        <button
          onClick={onClose}
          aria-label={labels.cancel}
          className="ms-auto flex h-9 w-9 items-center justify-center rounded-xl text-text-muted-light hover:bg-black/5"
        >
          <X size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "notes" && (
          <>
            {(highlights.length > 0 || bookmarks.length > 0) && (
              <div className="relative mb-3">
                <Search size={15} className="pointer-events-none absolute inset-y-0 my-auto start-3 text-text-muted-light" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={labels.searchNotes}
                  className="h-10 w-full rounded-xl border border-border-light bg-bg-light px-3 ps-9 text-[13px] outline-none focus:border-primary"
                />
              </div>
            )}

            {bookmarks.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-muted-light">
                  {labels.bookmarks}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {bookmarks.map((mark) => {
                    const marker = markerFor(mark.label);
                    return (
                      <button
                        key={mark.id}
                        onClick={() => onGo(mark.page)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onRemoveBookmark(mark.page);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-border-light px-2.5 py-1.5 text-[12px] transition hover:border-primary/40"
                      >
                        <span aria-hidden="true">{marker?.emoji ?? "🔖"}</span>
                        <span className="num text-text-secondary-light">{mark.page}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {byPage.length === 0 ? (
              <p className="px-1 py-10 text-center text-[12.5px] leading-relaxed text-text-muted-light">
                {query ? labels.noResults : labels.noMarks}
              </p>
            ) : (
              byPage.map(([page, marks]) => (
                <section key={page} className="mb-4">
                  <p className="num mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-muted-light">
                    {labels.page} {page}
                  </p>
                  <div className="flex flex-col gap-2">
                    {marks.map((mark) => (
                      <MarkCard
                        key={mark.id}
                        mark={mark}
                        labels={labels}
                        onGo={() => onGo(mark.page)}
                        onRecolour={(c) => onRecolour(mark.id, c)}
                        onDelete={() => onDelete(mark.id)}
                        onSetNote={(v) => onSetNote(mark.id, v)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}

        {tab === "notebook" && (
          <textarea
            value={notebook}
            onChange={(e) => onNotebook(e.target.value)}
            placeholder={labels.notebookPlaceholder}
            className="h-full min-h-[320px] w-full resize-none rounded-xl border border-border-light bg-bg-light p-3 text-[13.5px] leading-relaxed outline-none focus:border-primary"
          />
        )}

        {tab === "search" && doc && <DocumentSearch doc={doc} labels={labels} onGo={onGo} />}
      </div>

      <p className="shrink-0 border-t border-border-light px-3 py-2 text-[11px] text-text-muted-light">
        {locale === "ar"
          ? "اضغط على أي ملاحظة للعودة إلى موضعها في الصفحة."
          : "Tap any note to jump back to where you wrote it."}
      </p>
    </div>
  );
}

function MarkCard({
  mark,
  labels,
  onGo,
  onRecolour,
  onDelete,
  onSetNote,
}: {
  mark: Highlight;
  labels: Record<string, string>;
  onGo: () => void;
  onRecolour: (colour: Highlight["color"]) => void;
  onDelete: () => void;
  onSetNote: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group rounded-xl border border-border-light bg-bg-light p-2.5 transition hover:border-primary/30">
      <button onClick={onGo} className="block w-full text-start">
        <span className={cn("mb-1.5 block h-1.5 w-9 rounded-full", SWATCH[mark.color])} />
        <span className="line-clamp-3 block text-[12.5px] leading-relaxed text-text-secondary-light">
          {mark.quotedText || labels.noText}
        </span>
      </button>

      {editing ? (
        <textarea
          autoFocus
          defaultValue={mark.note ?? ""}
          rows={3}
          onBlur={(e) => {
            onSetNote(e.target.value.trim());
            setEditing(false);
          }}
          placeholder={labels.notePlaceholder}
          className="mt-2 w-full resize-none rounded-lg border border-border-light bg-surface-light p-2 text-[12.5px] outline-none focus:border-primary"
        />
      ) : (
        mark.note && (
          <p className="mt-2 rounded-lg bg-surface-light p-2 text-[12px] leading-relaxed text-text-primary-light">
            {mark.note}
          </p>
        )
      )}

      {/* Actions stay quiet until the card is touched. A row of icons on
          every note turns a page of thoughts into a control panel. */}
      <div className="mt-2 flex items-center gap-1.5 opacity-60 transition group-hover:opacity-100">
        {(["yellow", "green", "blue", "pink"] as const).map((colour) => (
          <button
            key={colour}
            onClick={() => onRecolour(colour)}
            aria-label={colour}
            className={cn(
              "h-4 w-4 rounded-full ring-1 ring-black/10",
              SWATCH[colour],
              mark.color === colour && "ring-2 ring-primary"
            )}
          />
        ))}
        <button
          onClick={() => setEditing((v) => !v)}
          aria-label={labels.addNote}
          className="ms-auto text-text-muted-light hover:text-primary"
        >
          <StickyNote size={14} />
        </button>
        <button onClick={onDelete} aria-label={labels.deleteMark} className="text-text-muted-light hover:text-error">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Full-text search across the document.
 *
 * PDF.js ships a find controller, but it drives its own viewer's DOM.
 * Asking each page for its text and matching in JavaScript is a few
 * lines, works with this renderer, and on a lecture handout — tens of
 * pages, not thousands — returns instantly.
 */
function DocumentSearch({
  doc,
  labels,
  onGo,
}: {
  doc: PdfDocument;
  labels: Record<string, string>;
  onGo: (page: number) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<{ page: number; snippet: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const needle = term.trim().toLowerCase();
    if (needle.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      const found: { page: number; snippet: string }[] = [];
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        const at = text.toLowerCase().indexOf(needle);
        if (at !== -1) {
          found.push({
            page: n,
            snippet: text.slice(Math.max(0, at - 45), at + needle.length + 65).trim(),
          });
        }
        if (found.length >= 60) break;
      }
      if (!cancelled) {
        setResults(found);
        setBusy(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setBusy(false);
    };
  }, [term, doc]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute inset-y-0 my-auto start-3 text-text-muted-light" />
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="h-10 w-full rounded-xl border border-border-light bg-bg-light px-3 ps-9 text-[13px] outline-none focus:border-primary"
        />
      </div>

      {busy && <p className="px-1 text-[12px] text-text-muted-light">{labels.searching}</p>}
      {!busy && term.trim().length >= 2 && results.length === 0 && (
        <p className="px-1 text-[12px] text-text-muted-light">{labels.noResults}</p>
      )}

      {results.map((result) => (
        <button
          key={`${result.page}-${result.snippet.slice(0, 14)}`}
          onClick={() => onGo(result.page)}
          className="rounded-xl border border-border-light bg-bg-light p-2.5 text-start transition hover:border-primary/40"
        >
          <span className="num mb-1 flex items-center gap-1.5 text-[11px] text-text-muted-light">
            <Bookmark size={11} />
            {labels.page} {result.page}
          </span>
          <span className="line-clamp-2 block text-[12.5px] leading-relaxed text-text-secondary-light">
            {result.snippet}
          </span>
        </button>
      ))}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] transition",
        active ? "bg-primary/10 font-semibold text-primary" : "text-text-secondary-light hover:bg-black/5"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export { MARKERS };
