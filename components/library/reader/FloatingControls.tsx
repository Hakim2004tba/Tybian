"use client";

import {
  ChevronLeft, ChevronRight, Rows3, StickyNote, Sparkles,
  Search, Bookmark, BookmarkCheck, Maximize2, Minimize2, Download, ArrowLeft, ArrowRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The controls, floating over the document instead of framing it.
 *
 * On a tablet the old permanent toolbar spent a fixed strip of screen
 * on buttons that are needed for a second at a time. These hover above
 * the page, sit within thumb reach at the bottom, and hide entirely in
 * focus mode or on a two-finger tap.
 *
 * Deliberately few. Everything here is used constantly; anything used
 * occasionally lives in the panel, and anything used once lives in the
 * document page around the reader. A toolbar long enough to read is
 * slower than the thing it replaced.
 */
export function FloatingControls({
  visible,
  page,
  pageCount,
  bookmarked,
  focus,
  panelOpen,
  onPrev,
  onNext,
  onThumbnails,
  onNotes,
  onAsk,
  onSearch,
  onBookmark,
  onFocus,
  downloadHref,
}: {
  visible: boolean;
  page: number;
  pageCount: number;
  bookmarked: boolean;
  focus: boolean;
  panelOpen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onThumbnails: () => void;
  onNotes: () => void;
  onAsk: () => void;
  onSearch: () => void;
  onBookmark: () => void;
  onFocus: () => void;
  downloadHref: string;
}) {
  const { t, isRtl } = useI18n();
  const labels = t.library;

  /* The arrow points the way the reader moves, which in Arabic is the
     other way. A fixed chevron reads as backwards to every RTL user. */
  const Back = isRtl ? ArrowRight : ArrowLeft;
  const Prev = isRtl ? ChevronRight : ChevronLeft;
  const Next = isRtl ? ChevronLeft : ChevronRight;
  void Back;

  const percent = pageCount > 0 ? Math.round((page / pageCount) * 100) : 0;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0"
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[22px] border border-black/5 bg-white/90 p-1.5 shadow-[0_14px_44px_-10px_rgba(23,15,46,0.4)] backdrop-blur-xl">
        <Pill label={labels.previousPage} onClick={onPrev} disabled={page <= 1}>
          <Prev size={19} />
        </Pill>

        {/* The page indicator doubles as the progress bar — one object
            answering "where am I" and "how much is left". */}
        <span className="flex min-w-[76px] flex-col items-center px-1.5">
          <span className="num text-[12.5px] font-semibold text-text-primary-light">
            {page} / {pageCount || "—"}
          </span>
          <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-academy-lavender">
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>

        <Pill label={labels.nextPage} onClick={onNext} disabled={pageCount > 0 && page >= pageCount}>
          <Next size={19} />
        </Pill>

        <span className="mx-0.5 h-7 w-px shrink-0 bg-black/10" aria-hidden="true" />

        <Pill label={labels.pages} onClick={onThumbnails}>
          <Rows3 size={18} />
        </Pill>

        <Pill label={labels.bookmark} onClick={onBookmark} active={bookmarked} tone="gold">
          {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </Pill>

        <Pill label={labels.search} onClick={onSearch}>
          <Search size={18} />
        </Pill>

        <Pill label={labels.notebook} onClick={onNotes} active={panelOpen}>
          <StickyNote size={18} />
        </Pill>

        <Pill label={labels.askAi} onClick={onAsk} tone="accent">
          <Sparkles size={18} />
        </Pill>

        <span className="mx-0.5 h-7 w-px shrink-0 bg-black/10" aria-hidden="true" />

        <Pill label={labels.focus} onClick={onFocus} active={focus}>
          {focus ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </Pill>

        <a
          href={downloadHref}
          aria-label={labels.download}
          title={labels.download}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-text-secondary-light transition active:scale-90 hover:bg-black/5"
        >
          <Download size={18} />
        </a>
      </div>
    </div>
  );
}

function Pill({
  label,
  onClick,
  disabled,
  active,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "gold" | "accent";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        /* 44px: the smallest target a finger hits reliably. Every
           control here clears it, on every layout. */
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90 disabled:opacity-25",
        tone === "accent"
          ? "bg-gradient-to-br from-primary to-secondary text-white"
          : active
            ? tone === "gold"
              ? "bg-gold/15 text-gold"
              : "bg-primary/12 text-primary"
            : "text-text-secondary-light hover:bg-black/5"
      )}
    >
      {children}
    </button>
  );
}
