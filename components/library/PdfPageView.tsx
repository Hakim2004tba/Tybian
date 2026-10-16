"use client";

import { useEffect, useRef, useState } from "react";
import { getPdfjs, type PdfDocument } from "@/components/library/pdf-engine";
import type { Highlight } from "@/lib/data/library";

export type PendingSelection = {
  page: number;
  rects: { x: number; y: number; w: number; h: number }[];
  text: string;
  /** Viewport coordinates, for placing the colour popover. */
  anchor: { x: number; y: number };
};

const COLOR_RGBA: Record<Highlight["color"], string> = {
  yellow: "rgba(253, 224, 71, 0.45)",
  green: "rgba(134, 239, 172, 0.45)",
  blue: "rgba(147, 197, 253, 0.45)",
  pink: "rgba(249, 168, 212, 0.45)",
};

/**
 * One rendered PDF page: a canvas, an invisible text layer over it, and
 * the student's highlights under both.
 *
 * WHY A TEXT LAYER. The canvas is pixels — there is nothing in it to
 * select. PDF.js can also emit the page's text as absolutely positioned
 * transparent spans laid exactly over the drawn glyphs; selecting those
 * is what makes a PDF behave like a web page, and it is the only way to
 * get a real selection to highlight. It is invisible, so what the
 * student sees is still the rendered page.
 *
 * WHY RENDER ONLY WHEN NEAR THE VIEWPORT. A 200-page PDF is 200 canvases;
 * drawing them all costs hundreds of megabytes and freezes the tab. Each
 * page draws when it comes within one screen of the viewport and keeps
 * its canvas afterwards — re-drawing on every scroll is worse than the
 * memory.
 */
export function PdfPageView({
  doc,
  pageNumber,
  scale,
  highlights,
  onSelect,
  onVisible,
  registerRef,
  ink,
}: {
  doc: PdfDocument;
  pageNumber: number;
  scale: number;
  highlights: Highlight[];
  onSelect: (selection: PendingSelection | null) => void;
  onVisible: (page: number) => void;
  registerRef: (page: number, el: HTMLDivElement | null) => void;
  /*
    The drawing surface for this page, supplied by the reader. Passed in
    rather than mounted here so one component owns the tool, the colour
    and the undo stack for the whole document — a per-page tool state
    would mean the pen changing colour as you scroll.
  */
  ink?: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const renderedAt = useRef<number | null>(null);

  /* Near-viewport detection, and "which page am I on" for the toolbar. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const nearby = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShouldRender(true);
      },
      { rootMargin: "800px 0px" }
    );
    const current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(pageNumber);
      },
      { threshold: 0.5 }
    );

    nearby.observe(host);
    current.observe(host);
    return () => {
      nearby.disconnect();
      current.disconnect();
    };
  }, [pageNumber, onVisible]);

  /* Draw. */
  useEffect(() => {
    if (!shouldRender) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      /*
        Draw at the device's real pixel density and scale back down with
        CSS. Without this, text on a phone or a Retina screen is drawn at
        a third of the resolution it is displayed at and looks blurred —
        which on a lecture handout is the difference between readable and
        not.
      */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      task = page.render({ canvasContext: context, viewport });
      try {
        await (task as unknown as { promise: Promise<void> }).promise;
      } catch {
        return; // cancelled by a scale change — not an error
      }
      if (cancelled) return;

      setSize({ width: viewport.width, height: viewport.height });
      renderedAt.current = scale;

      /* Text layer. */
      const layer = textLayerRef.current;
      if (layer) {
        layer.replaceChildren();
        layer.style.width = `${viewport.width}px`;
        layer.style.height = `${viewport.height}px`;
        const textContent = await page.getTextContent();
        if (cancelled) return;

        /* The same build as pdf-engine: mixing the default and legacy
           bundles loads the library twice and the second copy has no
           worker configured. */
        /* Through the same cached promise as the engine, so the
           module is fetched once rather than per page. */
        const { TextLayer } = await getPdfjs();
        const textLayer = new TextLayer({ textContentSource: textContent, container: layer, viewport });
        await textLayer.render();
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, scale, shouldRender]);

  /**
   * Turns a text selection into normalised rectangles.
   *
   * Normalised (0..1 of the page box) rather than pixels, because the
   * same highlight has to come back at a different zoom, on a different
   * screen width, and on a phone. Storing pixels would pin it to the
   * window it was made in.
   */
  /*
    WHY selectionchange AND NOT touchend.

    On a phone, selecting text is: long-press, a selection appears, then
    the two handles are dragged to widen it. `touchend` fires at the end
    of the long-press — BEFORE any of the dragging — so reading the
    selection there gets the browser's initial single-word guess, or
    nothing at all, and then never fires again as the handles move.
    That is why highlighting did nothing on a phone while working on a
    mouse: mouseup genuinely is the end of the gesture, touchend is the
    beginning of one.

    `selectionchange` fires throughout, including after every handle
    drag. It is debounced so the colour popover appears once the
    selection settles rather than flickering behind a moving handle.
  */
  useEffect(() => {
    let timer: number | undefined;

    function onSelectionChange() {
      window.clearTimeout(timer);
      timer = window.setTimeout(captureSelection, 350);
    }

    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.clearTimeout(timer);
    };
  });

  function captureSelection() {
    const selection = window.getSelection();
    const host = hostRef.current;
    if (!host || !size) return;

    /*
      Every mounted page listens to the same document-wide event, so a
      page that is not the one being selected in must stay silent —
      clearing here would have the page above cancel the popover the
      page below just opened.
    */
    if (
      !selection ||
      selection.rangeCount === 0 ||
      !host.contains(selection.anchorNode) ||
      !host.contains(selection.focusNode)
    ) {
      return;
    }

    if (selection.isCollapsed) {
      onSelect(null);
      return;
    }

    const hostBox = host.getBoundingClientRect();
    const raw = Array.from(selection.getRangeAt(0).getClientRects());
    if (raw.length === 0) {
      onSelect(null);
      return;
    }

    /*
      Client rects come one per line fragment, and browsers emit
      near-duplicates and hairline slivers around line breaks. The
      slivers are dropped by area; the duplicates are harmless.
    */
    const rects = raw
      .map((r) => ({
        x: (r.left - hostBox.left) / hostBox.width,
        y: (r.top - hostBox.top) / hostBox.height,
        w: r.width / hostBox.width,
        h: r.height / hostBox.height,
      }))
      .filter((r) => r.w > 0.002 && r.h > 0.004);

    if (rects.length === 0) {
      onSelect(null);
      return;
    }

    const last = raw[raw.length - 1];
    onSelect({
      page: pageNumber,
      rects,
      text: selection.toString(),
      anchor: { x: last.left + last.width / 2, y: last.top },
    });
  }

  return (
    <div
      ref={(el) => {
        hostRef.current = el;
        registerRef(pageNumber, el);
      }}
      data-page={pageNumber}
      onMouseUp={captureSelection}
      className="relative mx-auto bg-white shadow-lg"
      style={size ? { width: size.width, height: size.height } : { minHeight: 600, width: "100%", maxWidth: 820 }}
    >
      <canvas ref={canvasRef} className="block" />

      {/* Under the text layer, over the canvas. Multiply keeps the words
          readable through the colour instead of washing them out. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {highlights.map((h) =>
          h.rects.map((r, i) => (
            <div
              key={`${h.id}-${i}`}
              style={{
                position: "absolute",
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                background: COLOR_RGBA[h.color],
                mixBlendMode: "multiply",
                borderRadius: 2,
              }}
            />
          ))
        )}
      </div>

      <div
        ref={textLayerRef}
        className="textLayer absolute left-0 top-0 origin-top-left"
        style={{ lineHeight: 1 }}
      />

      {/* Over the text layer: while a tool is armed the ink must get the
          pointer, not the selection. It makes itself inert otherwise. */}
      {ink}

      {!size && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-text-muted-light">
          <span className="num">{pageNumber}</span>
        </div>
      )}
    </div>
  );
}
