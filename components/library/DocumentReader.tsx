"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPdf, type PdfDocument } from "@/components/library/pdf-engine";
import { PdfPageView, type PendingSelection } from "@/components/library/PdfPageView";
import { PageThumbnails } from "@/components/library/PageThumbnails";
import { SelectionBar } from "@/components/library/reader/SelectionBar";
import { FloatingControls } from "@/components/library/reader/FloatingControls";
import { StudyPanel, type PanelTab } from "@/components/library/reader/StudyPanel";
import { ThumbnailDrawer, BottomSheet, SplitPane } from "@/components/library/reader/ReaderChrome";
import { useGestures } from "@/components/library/reader/useGestures";
import { useLayout } from "@/lib/library/use-layout";
import { InkLayer } from "@/components/library/reader/InkLayer";
import { ToolsFab } from "@/components/library/reader/ToolsFab";
import { saveInkAction, loadInkAction } from "@/lib/library/ink-actions";
import {
  INK_COLORS, MARKER_COLORS, PEN_WIDTHS, MARKER_WIDTHS,
  type InkStroke, type InkTool,
} from "@/lib/library/ink";
import { askAi } from "@/lib/ai/ask-event";
import type { Highlight } from "@/lib/data/library";
import {
  addHighlightAction, updateHighlightAction, deleteHighlightAction,
  saveNoteAction, toggleBookmarkAction, saveProgressAction, markOpenedAction,
  reportPageCountAction,
} from "@/lib/library/actions";
import { fitScaleFor } from "@/lib/library/fit";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The reading workspace.
 *
 * WHAT CHANGED AND WHY. The previous version was one desktop layout
 * that shrank: a permanent toolbar strip, a permanent thumbnail rail, a
 * permanent side column, and a highlight flow that took four moments —
 * select, open a popover, choose a colour, watch it apply. On a tablet
 * that spent most of the screen on chrome and most of the student's
 * patience on steps.
 *
 * This is three interaction models over one set of parts:
 *
 *   desktop  rail + document + resizable panel
 *   tablet   document almost edge to edge, controls floating over it,
 *            thumbnails and panel as drawers
 *   phone    full-screen document, one floating bar within thumb
 *            reach, everything else as a bottom sheet
 *
 * The document is the hero in all three. Chrome hides on a two-finger
 * tap and in focus mode, and the floating bar is the only thing that
 * ever sits on top of the page.
 *
 * THE STATE AND THE SERVER ACTIONS ARE UNCHANGED. Highlights,
 * bookmarks, the notebook, progress and page-count reporting all work
 * exactly as before — this is a new body around a spine that was
 * already right.
 */
export function DocumentReader({
  documentId,
  fileUrl,
  title,
  initialHighlights,
  initialNote,
  initialBookmarks,
  initialPage,
  knownPageCount,
}: {
  documentId: string;
  fileUrl: string;
  title: string;
  initialHighlights: Highlight[];
  initialNote: string;
  initialBookmarks: { id: string; page: number; label: string | null }[];
  initialPage: number;
  knownPageCount: number | null;
}) {
  const { t: T, locale } = useI18n();
  const t = T.library;

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [pageCount, setPageCount] = useState(knownPageCount ?? 0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.2);

  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [note, setNote] = useState(initialNote);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [panelTab, setPanelTab] = useState<PanelTab>("notes");


  /* ---- the new chrome ---- */
  const { layout, landscape, coarse, pen } = useLayout();
  const [panelOpen, setPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [chrome, setChrome] = useState(true);

  /*
    THE PEN.

    One tool, one colour and one undo stack for the whole document —
    not per page. A pen that changes colour as you scroll is not a pen.

    `ink` is the authoritative copy while drawing; the database is
    written after the hand stops. See saveInkAction for why.
  */
  const [tool, setTool] = useState<InkTool | null>(null);
  const [inkColor, setInkColor] = useState<string>(INK_COLORS[0]);
  const [inkWidth, setInkWidth] = useState<number>(PEN_WIDTHS[1]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ink, setInk] = useState<Record<number, InkStroke[]>>({});
  const [undoStack, setUndoStack] = useState<{ page: number; strokes: InkStroke[] }[]>([]);

  /* Load every page's ink once, when the document opens. */
  useEffect(() => {
    let cancelled = false;
    loadInkAction(documentId).then((saved) => {
      if (!cancelled) setInk(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  /* Choosing a tool swaps to that tool's own palette and nib, so the
     highlighter is never armed with pen-black. */
  function armTool(next: InkTool | null) {
    setTool(next);
    if (next === "marker") {
      setInkColor(MARKER_COLORS[0]);
      setInkWidth(MARKER_WIDTHS[1]);
    } else if (next === "pen") {
      setInkColor(INK_COLORS[0]);
      setInkWidth(PEN_WIDTHS[1]);
    }
  }

  /*
    Saved after the hand stops, not on every stroke.

    A page drawn on for a minute is hundreds of strokes; writing each
    one would be hundreds of round trips and a visibly stuttering pen.
    Nine hundred milliseconds is long enough to cover the pause between
    two strokes of the same word and short enough that nothing is lost
    to a closed tab.
  */
  const pendingSave = useRef<number | null>(null);
  function persistPage(page: number, strokes: InkStroke[]) {
    if (pendingSave.current) window.clearTimeout(pendingSave.current);
    pendingSave.current = window.setTimeout(() => {
      void saveInkAction(documentId, page, strokes);
    }, 900);
  }

  function commitStroke(page: number, stroke: InkStroke) {
    setInk((all) => {
      const before = all[page] ?? [];
      setUndoStack((stack) => [...stack.slice(-40), { page, strokes: before }]);
      const next = [...before, stroke];
      persistPage(page, next);
      return { ...all, [page]: next };
    });
  }

  function replacePage(page: number, strokes: InkStroke[]) {
    setInk((all) => {
      const before = all[page] ?? [];
      if (before.length === strokes.length) return all;
      setUndoStack((stack) => [...stack.slice(-40), { page, strokes: before }]);
      persistPage(page, strokes);
      return { ...all, [page]: strokes };
    });
  }

  function undoInk() {
    setUndoStack((stack) => {
      const last = stack[stack.length - 1];
      if (!last) return stack;
      setInk((all) => ({ ...all, [last.page]: last.strokes }));
      persistPage(last.page, last.strokes);
      return stack.slice(0, -1);
    });
  }

  /*
    A panel beside the document needs width to be worth it. Desktop and
    a landscape tablet have it; a phone and a portrait tablet do not, so
    there the same panel arrives as a sheet instead.
  */
  const panelBeside = layout === "desktop" || (layout === "tablet" && landscape);

  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const jumpedToStart = useRef(false);

  /* ---- open the document ---- */
  useEffect(() => {
    let cancelled = false;
    /*
      loadPdf is async now — it imports the engine on first use (see
      pdf-engine.ts), so the task itself only exists after that lands.
      The cleanup has to cope with unmounting BEFORE it does, which is
      what `destroyed` tracks: without it, opening a document and
      immediately navigating away leaks the worker.
    */
    let task: Awaited<ReturnType<typeof loadPdf>> | null = null;

    loadPdf(fileUrl).then(
      (t) => {
        task = t;
        if (cancelled) {
          void t.destroy();
          return;
        }
        t.promise.then(
          (d) => {
            if (cancelled) return;
            setDoc(d);
            setPageCount(d.numPages);
            if (knownPageCount === null) void reportPageCountAction(documentId, d.numPages);
          },
          () => !cancelled && setFailed(true)
        );
      },
      () => !cancelled && setFailed(true)
    );

    void markOpenedAction(documentId);
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [fileUrl, documentId, knownPageCount]);

  /* ---- resume where they stopped, once ---- */
  useEffect(() => {
    if (!doc || jumpedToStart.current || initialPage <= 1) return;
    jumpedToStart.current = true;
    /*
      A frame's delay, not an immediate scroll: the target page has not
      been laid out yet at this point, so its offset is still 0 and the
      scroll silently does nothing.
    */
    const timer = window.setTimeout(() => goToPage(initialPage), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  /* ---- remember the page, but not on every scroll tick ---- */
  const lastSaved = useRef(initialPage);
  useEffect(() => {
    if (currentPage === lastSaved.current) return;
    const timer = window.setTimeout(() => {
      lastSaved.current = currentPage;
      void saveProgressAction(documentId, currentPage);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [currentPage, documentId]);

  /* ---- the notebook, debounced ---- */
  const noteFirstRun = useRef(true);
  useEffect(() => {
    if (noteFirstRun.current) {
      noteFirstRun.current = false;
      return;
    }
    const timer = window.setTimeout(() => void saveNoteAction(documentId, note), 800);
    return () => window.clearTimeout(timer);
  }, [note, documentId]);

  const registerRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  const onVisible = useCallback((page: number) => setCurrentPage(page), []);

  function goToPage(page: number) {
    const target = Math.min(Math.max(1, page), pageCount || page);
    pageRefs.current.get(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(target);
  }

  /* ---- highlighting ---- */
  async function commitHighlight(color: Highlight["color"]) {
    if (!pending) return;
    const temporaryId = `pending-${Date.now()}`;
    const optimistic: Highlight = {
      id: temporaryId,
      page: pending.page,
      color,
      rects: pending.rects,
      quotedText: pending.text,
      note: null,
    };
    setHighlights((list) => [...list, optimistic]);
    setPending(null);
    window.getSelection()?.removeAllRanges();

    const result = await addHighlightAction({
      documentId,
      page: optimistic.page,
      color,
      rects: optimistic.rects,
      quotedText: optimistic.quotedText ?? "",
    });

    setHighlights((list) =>
      result.ok && result.id
        ? list.map((h) => (h.id === temporaryId ? { ...h, id: result.id! } : h))
        : list.filter((h) => h.id !== temporaryId)
    );
  }

  async function removeHighlight(id: string) {
    setHighlights((list) => list.filter((h) => h.id !== id));
    await deleteHighlightAction(documentId, id);
  }

  async function recolour(id: string, color: Highlight["color"]) {
    setHighlights((list) => list.map((h) => (h.id === id ? { ...h, color } : h)));
    await updateHighlightAction({ documentId, highlightId: id, color });
  }

  async function setHighlightNote(id: string, value: string) {
    setHighlights((list) => list.map((h) => (h.id === id ? { ...h, note: value || null } : h)));
    await updateHighlightAction({ documentId, highlightId: id, note: value });
  }

  async function toggleBookmark() {
    const result = await toggleBookmarkAction(documentId, currentPage, null);
    if (!result.ok) return;
    setBookmarks((list) =>
      result.bookmarked
        ? [...list, { id: `b-${currentPage}`, page: currentPage, label: null }].sort((a, b) => a.page - b.page)
        : list.filter((b) => b.page !== currentPage)
    );
  }

  const bookmarked = bookmarks.some((b) => b.page === currentPage);
  const byPage = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    for (const h of highlights) map.set(h.page, [...(map.get(h.page) ?? []), h]);
    return map;
  }, [highlights]);

  /* ---- gestures: the tablet's real interface ---- */
  const scrollHost = useRef<HTMLDivElement | null>(null);

  /*
    FIT THE WIDTH, on first open and on rotation.

    The old reader opened at a fixed 1.2× whatever the screen was. On a
    375px phone that renders an A4 page about 40% wider than the
    viewport, so the right-hand side of every slide was simply off
    screen — which is exactly what the page looked like. Nobody wants
    to start a lesson by pinching it into view.

    Measured from the real container, and only until the student zooms
    themselves; after that their choice stands.
  */
  const [autoFit, setAutoFit] = useState(true);

  /*
    The two measurements the fit is made of, kept in state so the zoom
    is DERIVED at render rather than pushed in by an effect.

    Pushing it was the bug behind "the assistant covers the lesson".
    Docking the panel shrinks the reader through body padding, and the
    effect that was supposed to notice ran on its own schedule — when
    it did not fire, the document kept a width its column no longer
    had and the left of every page sat unreachable under the panel.
    Derived, there is no schedule to miss: a narrower host is a
    narrower page in the same render.
  */
  const [hostWidth, setHostWidth] = useState(0);
  const [baseWidth, setBaseWidth] = useState(0);

  useEffect(() => {
    const host = scrollHost.current;
    if (!host) return;
    const read = () => setHostWidth(host.clientWidth);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(host);
    return () => observer.disconnect();
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(1);
      if (!cancelled) setBaseWidth(page.getViewport({ scale: 1 }).width);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, landscape, layout]);

  /*
    24px of breathing room, and never blown up past 2x — a short page
    stretched to fill a desktop looks like a mistake. A host width of 0
    means "not laid out yet": fall back rather than fit to nothing.
  */
  const fitScale = fitScaleFor(hostWidth, baseWidth);

  /* The student's own zoom wins once they have set one. */
  const renderScale = autoFit && fitScale !== null ? fitScale : scale;

  const zoomBy = useCallback(
    (factor: number) => {
      /* Zooming starts from the size on screen, not from a `scale` the
         fit may have been overriding. */
      setScale(Math.min(3, Math.max(0.5, +(renderScale * factor).toFixed(2))));
      setAutoFit(false);
    },
    [renderScale]
  );

  /* Double tap returns to fit — the thing anyone actually wants after
     pinching around a diagram, without hunting for a control. */
  const fitOrReset = useCallback(() => {
    setAutoFit(true);
  }, []);

  useGestures({
    ref: scrollHost,
    enabled: coarse,
    onPrev: () => goToPage(currentPage - 1),
    onNext: () => goToPage(currentPage + 1),
    onZoom: zoomBy,
    onToggleChrome: () => setChrome((v) => !v),
    onFit: fitOrReset,
  });

  /* ---- one-tap actions from the selection bar ---- */

  async function highlightAndNote(colour: Highlight["color"], withNote: boolean) {
    if (!pending) return;
    const quoted = pending.text;
    await commitHighlight(colour);
    if (withNote) {
      /* The note opens on the mark that was just made, in the panel,
         already scrolled to it. The student never hunts for it. */
      setPanelTab("notes");
      setPanelOpen(true);
    }
    void quoted;
  }

  function askAboutSelection() {
    if (!pending) return;
    const quote = pending.text.trim().slice(0, 1200);
    setPending(null);
    window.getSelection()?.removeAllRanges();
    if (quote) askAi(`${t.askAi} — ${title}:\n\n"${quote}"`);
  }

  /* ---- markers ---- */
  async function markPage(marker: string) {
    const result = await toggleBookmarkAction(documentId, currentPage, marker);
    if (!result.ok) return;
    setBookmarks((list) =>
      result.bookmarked
        ? [...list, { id: `b-${currentPage}`, page: currentPage, label: marker }].sort((a, b) => a.page - b.page)
        : list.filter((b) => b.page !== currentPage)
    );
  }

  async function removeBookmarkAt(page: number) {
    const result = await toggleBookmarkAction(documentId, page, null);
    if (result.ok && !result.bookmarked) {
      setBookmarks((list) => list.filter((b) => b.page !== page));
    }
  }

  /* ---- failure ---- */
  if (failed) {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-10 text-center">
        <p className="text-[14px] text-text-primary-light">{t.openFailed}</p>
        <a
          href={`${fileUrl}?download=1`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-white"
        >
          <Download size={15} />
          {t.download}
        </a>
      </div>
    );
  }

  const panelNode = (
    <StudyPanel
      tab={panelTab}
      onTab={setPanelTab}
      doc={doc}
      highlights={highlights}
      bookmarks={bookmarks}
      notebook={note}
      onNotebook={setNote}
      onGo={(p) => {
        goToPage(p);
        if (!panelBeside) setPanelOpen(false);
      }}
      onRecolour={recolour}
      onDelete={removeHighlight}
      onSetNote={setHighlightNote}
      onRemoveBookmark={removeBookmarkAt}
      onClose={() => setPanelOpen(false)}
    />
  );

  const showChrome = chrome && !focus;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-light",
        /*
          Focus mode takes the whole viewport rather than growing a card
          inside the page. Anything less is "a bigger box on a website",
          which is exactly what this redesign is trying to stop being.
        */
        focus
          ? "fixed inset-0 z-[70] rounded-none border-0"
          : layout === "phone"
            ? "h-[calc(100vh-150px)] min-h-[460px]"
            : "h-[calc(100vh-190px)] min-h-[520px]"
      )}
    >
      <div className="flex min-h-0 flex-1">
        {/*
          DESKTOP ONLY: a permanent rail. It is the one layout with
          width to spare, and a mouse has no drawer gesture to replace
          it with.
        */}
        {/*
          OFF UNTIL ASKED FOR.

          The rail used to be permanent on a desktop, so every lesson
          opened with a column of thumbnails taking width from the thing
          being read. It is a map you consult, not something you stare
          at — the pages button in the bottom bar toggles it, and the
          document keeps that width the rest of the time.
        */}
        {layout === "desktop" && !focus && drawerOpen && (
          <aside className="hidden w-[150px] shrink-0 border-e border-border-light bg-bg-light xl:block">
            <PageThumbnails doc={doc} pageCount={pageCount} currentPage={currentPage} onGo={goToPage} />
          </aside>
        )}

        <SplitPane open={panelOpen && panelBeside && !focus} panel={panelNode}>
          <div
            ref={scrollHost}
            className="h-full min-w-0 overflow-auto bg-academy-lavender"
            /* Room for the floating bar, so the last page is reachable
               rather than sitting under it. */
            style={{ paddingBottom: showChrome ? 88 : 16, paddingTop: 16 }}
          >
            {!doc ? (
              <div className="flex h-full items-center justify-center text-[13.5px] text-text-muted-light">
                {t.loading}
              </div>
            ) : (
              <div className={cn("flex flex-col items-center gap-4 px-3", tool !== null && "ink-armed")}>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <PdfPageView
                    key={n}
                    doc={doc}
                    pageNumber={n}
                    scale={renderScale}
                    highlights={byPage.get(n) ?? []}
                    onSelect={setPending}
                    onVisible={setCurrentPage}
                    registerRef={registerRef}
                    ink={
                      <InkLayer
                        strokes={ink[n] ?? []}
                        tool={tool ?? "pen"}
                        color={inkColor}
                        width={inkWidth}
                        active={tool !== null}
                        penSeen={pen}
                        onCommit={(stroke) => commitStroke(n, stroke)}
                        onErase={(keep) => replacePage(n, keep)}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </SplitPane>
      </div>

      {/* ---- thumbnails: a drawer everywhere but the desktop rail ---- */}
      <ThumbnailDrawer open={drawerOpen && layout !== "desktop"} onClose={() => setDrawerOpen(false)}>
        <PageThumbnails
          doc={doc}
          pageCount={pageCount}
          currentPage={currentPage}
          onGo={(p) => {
            goToPage(p);
            setDrawerOpen(false);
          }}
        />
      </ThumbnailDrawer>

      {/* ---- the panel as a sheet where there is no width for a column ---- */}
      {!panelBeside && (
        <BottomSheet open={panelOpen} onClose={() => setPanelOpen(false)}>
          <div className="h-[70vh]">{panelNode}</div>
        </BottomSheet>
      )}

      <FloatingControls
        visible={showChrome || focus}
        page={currentPage}
        pageCount={pageCount}
        bookmarked={bookmarked}
        focus={focus}
        panelOpen={panelOpen}
        onPrev={() => goToPage(currentPage - 1)}
        onNext={() => goToPage(currentPage + 1)}
        onThumbnails={() => setDrawerOpen((v) => !v)}
        onNotes={() => {
          setPanelTab("notes");
          setPanelOpen((v) => !v);
        }}
        onAsk={() => askAi(`${t.askAi} — ${title}`)}
        onSearch={() => {
          setPanelTab("search");
          setPanelOpen(true);
        }}
        onBookmark={() => markPage("important")}
        onFocus={() => setFocus((v) => !v)}
        downloadHref={`${fileUrl}?download=1`}
      />

      {/*
        THE STUDY TOOLS.

        A pen and a highlighter you drag across the page, not a text
        selection you colour in afterwards. One circle, the same shape
        as the AI button it sits above, opening a tray where one tap
        arms a tool and the next drag draws.
      */}
      <ToolsFab
        open={toolsOpen}
        onOpen={setToolsOpen}
        tool={tool}
        color={inkColor}
        width={inkWidth}
        onTool={armTool}
        onColor={setInkColor}
        onWidth={setInkWidth}
        onUndo={undoInk}
        canUndo={undoStack.length > 0}
        offsetClass={focus ? "bottom-24 start-4" : "bottom-24 start-4"}
      />

      {/* ---- the selection bar ---- */}
      {pending && (
        <SelectionBar
          anchor={pending.anchor}
          coarse={coarse || pen}
          onHighlight={(colour) => void highlightAndNote(colour, false)}
          onNote={() => void highlightAndNote("yellow", true)}
          onAsk={askAboutSelection}
          onDismiss={() => {
            setPending(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </div>
  );
}
