"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfDocument } from "@/components/library/pdf-engine";
import { cn } from "@/lib/utils";

/**
 * The page rail: every page as a small picture, the current one marked.
 *
 * Scrolling a fifty-page handout to find the diagram you remember is
 * the single most common thing a student does in a document, and a
 * page NUMBER does not help with it — the picture does. This is the
 * navigation the mock-up puts first, and it earns the space.
 *
 * RENDERED LAZILY AND ONCE. Fifty thumbnails drawn eagerly is fifty
 * canvases and a frozen tab on a phone; drawn on every scroll it is a
 * permanent CPU tax. Each one draws when it first comes near the rail's
 * viewport and is then left alone.
 */
export function PageThumbnails({
  doc,
  pageCount,
  currentPage,
  onGo,
}: {
  doc: PdfDocument | null;
  pageCount: number;
  currentPage: number;
  onGo: (page: number) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  /* Keep the current page visible as the student scrolls the document,
     so the rail stays a map rather than a list they must hunt through. */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  return (
    <div ref={listRef} className="scrollbar-none flex h-full flex-col gap-3 overflow-y-auto px-3 py-3">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          ref={n === currentPage ? activeRef : undefined}
          onClick={() => onGo(n)}
          aria-current={n === currentPage ? "page" : undefined}
          /*
            A page of paper, not a filmstrip cell. The old rail drew a
            hard border round every thumbnail and laid a dark bar with
            the number across the bottom of each one, so a column of
            slides read as a stack of grey boxes. Now each page sits on
            white with a soft shadow, the number is a small pill in the
            corner, and only the page being read is outlined.
          */
          className={cn(
            "group relative shrink-0 overflow-hidden rounded-xl bg-white transition",
            "ring-1 ring-black/5 shadow-[0_1px_3px_rgba(23,15,46,0.08)]",
            n === currentPage
              ? "ring-2 ring-primary shadow-[0_6px_18px_-6px_rgba(108,76,241,0.55)]"
              : "hover:ring-primary/40 hover:shadow-[0_6px_16px_-8px_rgba(23,15,46,0.35)]"
          )}
        >
          <Thumbnail doc={doc} pageNumber={n} />
          <span
            className={cn(
              "absolute bottom-1.5 end-1.5 min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none",
              n === currentPage
                ? "bg-primary text-white"
                : "bg-black/55 text-white/95 group-hover:bg-black/70"
            )}
          >
            <span className="num">{n}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Thumbnail({ doc, pageNumber }: { doc: PdfDocument | null; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [near, setNear] = useState(pageNumber <= 6);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!doc || !near || drawn) return;
    let cancelled = false;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;

      /* A fixed 120px width: the rail is narrow and a thumbnail only has
         to be recognisable, not readable. Scaling from the page's own
         size keeps portrait and landscape pages both correct. */
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 120 / base.width });

      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const context = canvas.getContext("2d");
      if (!context) return;

      try {
        await (page.render({ canvasContext: context, viewport }) as unknown as { promise: Promise<void> })
          .promise;
        if (!cancelled) setDrawn(true);
      } catch {
        /* cancelled by a re-render — not an error */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, near, drawn]);

  return (
    <canvas
      ref={ref}
      className="block w-[120px] bg-paper"
      style={{ minHeight: drawn ? undefined : 150 }}
    />
  );
}
