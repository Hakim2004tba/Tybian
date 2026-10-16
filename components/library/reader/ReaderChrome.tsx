"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Rows3 } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The three frames the reader lives inside.
 *
 * Same contents, three interaction models — the point of the redesign.
 * A panel is a column on a desktop, a draggable column on a landscape
 * tablet, and a sheet from the bottom on a phone, because that is where
 * each of those hands can reach.
 */

/* ------------------------------------------------------------------ */
/*  A drawer for the page thumbnails                                   */
/* ------------------------------------------------------------------ */

/**
 * Slides in over the document rather than taking a permanent column.
 *
 * Thumbnails are used in bursts — find the diagram, jump, forget them
 * for ten minutes. A permanent rail spends a sixth of a tablet screen
 * on something needed a few seconds at a time; the old reader did
 * exactly that.
 *
 * It closes itself after a page is chosen. That is the whole gesture:
 * open, find, gone.
 */
export function ThumbnailDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 start-0 flex w-[168px] flex-col border-e border-border-light bg-surface-light shadow-2xl transition-transform duration-300 ease-out",
          /* `start` + a translate that follows the writing direction, so
             the drawer enters from the side the reader begins on. */
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-light px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary-light">
            <Rows3 size={14} />
            {t.library.thumbnails}
          </span>
          <button
            onClick={onClose}
            aria-label={t.library.cancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted-light hover:bg-black/5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  A sheet for phones                                                 */
/* ------------------------------------------------------------------ */

/** Kept mounted and translated away, so a half-typed note survives an
 *  accidental close and the sheet slides rather than appears. */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col overflow-hidden rounded-t-3xl bg-surface-light shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center py-2.5">
          <span className="h-1 w-10 rounded-full bg-border-light" />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  A resizable column for tablets and desktops                        */
/* ------------------------------------------------------------------ */

/**
 * The split view, with a divider the student can drag.
 *
 * Fixed at 30% the panel is too narrow to write in and too wide to
 * read past; the right ratio depends on whether they are reading or
 * writing, and that changes minute to minute. Dragging is the only
 * honest answer.
 *
 * Constrained to 24–56%: past either end one of the two panes stops
 * being usable, and a divider that can destroy the layout is a divider
 * people avoid touching.
 */
export function SplitPane({
  open,
  children,
  panel,
}: {
  open: boolean;
  children: ReactNode;
  panel: ReactNode;
}) {
  const [ratio, setRatio] = useState(0.3);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem("tibyan_reader_split"));
      if (saved >= 0.24 && saved <= 0.56) setRatio(saved);
    } catch {
      /* the default is fine */
    }
  }, []);

  useEffect(() => {
    function move(event: PointerEvent) {
      const host = hostRef.current;
      if (!dragging.current || !host) return;

      const box = host.getBoundingClientRect();
      /* Measured from the panel's own edge, which is the start side in
         RTL and the end side in LTR — otherwise the divider runs the
         wrong way for Arabic readers. */
      const rtl = document.documentElement.dir === "rtl";
      const fromEdge = rtl ? event.clientX - box.left : box.right - event.clientX;
      const next = Math.min(0.56, Math.max(0.24, fromEdge / box.width));
      setRatio(next);
    }

    function up() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem("tibyan_reader_split", String(ratio));
      } catch {
        /* preference will not persist */
      }
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [ratio]);

  return (
    <div ref={hostRef} className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">{children}</div>

      {open && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={() => {
              dragging.current = true;
              /* Stops the drag from selecting the document's text
                 layer, which would leave a stray selection behind. */
              document.body.style.userSelect = "none";
            }}
            className="group relative w-1.5 shrink-0 cursor-col-resize bg-border-light transition hover:bg-primary/40"
          >
            <span className="absolute inset-y-0 -inset-x-2" aria-hidden="true" />
          </div>

          <div
            className="min-h-0 shrink-0 border-s border-border-light"
            style={{ width: `${ratio * 100}%` }}
          >
            {panel}
          </div>
        </>
      )}
    </div>
  );
}
