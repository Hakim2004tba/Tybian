"use client";

import { useEffect, useRef } from "react";
import { strokeHit, type InkStroke, type InkTool } from "@/lib/library/ink";

/**
 * The sheet you draw on, sitting over one rendered page.
 *
 * THIS IS THE HIGHLIGHTER. Not "select text, then choose a colour" —
 * that is a text editor's idea of highlighting. A student drags a nib
 * across the line, the way they do on paper, and the ink lands where
 * the hand went. Nothing here knows or cares where the words are.
 *
 * TWO CANVASES, and the reason matters. The lower one holds every
 * finished stroke and is repainted only when that list changes. The
 * upper one holds the single stroke in progress. Repainting a page of
 * strokes on every pointermove is what makes drawing feel like dragging
 * treacle; this way the expensive canvas is still and the moving one
 * has a single line on it.
 *
 * PALM REJECTION. Once a pen has been seen, touch stops drawing —
 * the hand resting on an iPad is touch, the nib is pen, and the
 * browser tells them apart. Before any pen appears, touch draws,
 * because a phone has nothing else.
 */
export function InkLayer({
  strokes,
  tool,
  color,
  width,
  active,
  penSeen,
  onCommit,
  onErase,
}: {
  strokes: InkStroke[];
  tool: InkTool;
  color: string;
  width: number;
  /** Off entirely while reading, so text selection and scrolling work. */
  active: boolean;
  penSeen: boolean;
  onCommit: (stroke: InkStroke) => void;
  onErase: (keep: InkStroke[]) => void;
}) {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<[number, number][] | null>(null);
  const pointerId = useRef<number | null>(null);

  /*
    TWO FINGERS SCROLL, one finger draws.

    With a tool armed the canvas must claim the gesture (`touch-action:
    none`), or the page slides out from under the nib mid-stroke. The
    cost is that the browser then scrolls for nothing — which is why
    arming the pen on a phone made the lesson feel stuck.

    So the scrolling is done here instead: the moment a second finger
    lands, whatever was being drawn is abandoned and the two fingers
    pan the page, exactly as they would with no tool armed. The student
    never has to put the pen down to move down the page.
  */
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panning = useRef(false);
  const panFrom = useRef<{ x: number; y: number } | null>(null);

  /** The element that actually scrolls the document. */
  function scrollHost(from: HTMLElement | null): HTMLElement | null {
    let node: HTMLElement | null = from;
    while (node) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function centre(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const point of activePointers.current.values()) {
      x += point.x;
      y += point.y;
    }
    const n = activePointers.current.size || 1;
    return { x: x / n, y: y / n };
  }

  /** Drop the stroke in progress without committing it. */
  function abandonStroke() {
    drawing.current = null;
    pointerId.current = null;
    const live = liveRef.current;
    if (live) live.getContext("2d")?.clearRect(0, 0, live.width, live.height);
  }

  /* ---- repaint the finished strokes ---- */
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas) return;
    paint(canvas, strokes);
  }, [strokes]);

  /* Keep both canvases the size of the page they cover. A page that
     re-renders at a new zoom changes size under us. */
  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const resize = () => {
      const host = base.parentElement;
      if (!host) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const canvas of [baseRef.current, liveRef.current]) {
        if (!canvas) continue;
        canvas.width = Math.floor(host.clientWidth * dpr);
        canvas.height = Math.floor(host.clientHeight * dpr);
      }
      paint(base, strokes);
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (base.parentElement) observer.observe(base.parentElement);
    return () => observer.disconnect();
  }, [strokes]);

  function relative(event: React.PointerEvent): [number, number] {
    const box = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height];
  }

  function shouldDraw(event: React.PointerEvent): boolean {
    if (!active) return false;
    /* The palm. See the note at the top. */
    if (penSeen && event.pointerType === "touch") return false;
    return true;
  }

  function onDown(event: React.PointerEvent<HTMLCanvasElement>) {
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    /* A second finger turns the gesture into a scroll, whatever it
       started as. */
    if (activePointers.current.size >= 2) {
      abandonStroke();
      panning.current = true;
      panFrom.current = centre();
      return;
    }

    if (!shouldDraw(event)) return;
    /* Capture keeps the stroke with this canvas even when the nib
       wanders off the page edge. If the browser refuses the capture,
       the stroke must still be drawn — never let this abort onDown. */
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* no capture; drawing continues */
    }
    pointerId.current = event.pointerId;

    const point = relative(event);

    if (tool === "eraser") {
      onErase(strokes.filter((s) => !strokeHit(s, point[0], point[1], 0.02)));
      return;
    }

    drawing.current = [point];
  }

  function onMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (panning.current) {
      const host = scrollHost(event.currentTarget);
      const now = centre();
      const from = panFrom.current;
      if (host && from) {
        host.scrollTop -= now.y - from.y;
        host.scrollLeft -= now.x - from.x;
      }
      panFrom.current = now;
      return;
    }

    if (pointerId.current !== event.pointerId) return;

    const point = relative(event);

    if (tool === "eraser") {
      onErase(strokes.filter((s) => !strokeHit(s, point[0], point[1], 0.02)));
      return;
    }

    const path = drawing.current;
    if (!path) return;

    /*
      Skip points the hand did not really move to. A stylus reports
      hundreds of samples a second and most of them are the same place;
      keeping them all triples the stored size for a line nobody can
      tell apart.
    */
    const [lx, ly] = path[path.length - 1];
    if (Math.hypot(point[0] - lx, point[1] - ly) < 0.0015) return;

    path.push(point);

    const canvas = liveRef.current;
    if (canvas) paint(canvas, [{ tool: tool === "marker" ? "marker" : "pen", color, width, points: path }]);
  }

  function onUp(event: React.PointerEvent<HTMLCanvasElement>) {
    activePointers.current.delete(event.pointerId);

    if (panning.current) {
      /* Stay in pan until every finger is off, so lifting one of two
         does not suddenly start drawing a line with the other. */
      if (activePointers.current.size === 0) {
        panning.current = false;
        panFrom.current = null;
      } else {
        panFrom.current = centre();
      }
      return;
    }

    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;

    const path = drawing.current;
    drawing.current = null;

    const live = liveRef.current;
    if (live) live.getContext("2d")?.clearRect(0, 0, live.width, live.height);

    if (!path || path.length < 2) return;
    onCommit({ tool: tool === "marker" ? "marker" : "pen", color, width, points: path });
  }

  return (
    <>
      {/*
        z-index, and it is not cosmetic. `.textLayer` carries
        `z-index: 2` (globals.css), so coming later in the DOM is not
        enough — without a higher layer here the transparent text sits
        ON TOP of the nib and every drag became a text selection
        instead of a line. That was the whole bug.
      */}
      <canvas
        ref={baseRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ zIndex: 3 }}
      />
      <canvas
        ref={liveRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute inset-0 h-full w-full"
        style={{
          /* Inert while reading, so selection and scrolling are normal.
             `touch-action: none` only while drawing, or the page would
             scroll out from under the nib. */
          zIndex: 4,
          pointerEvents: active ? "auto" : "none",
          touchAction: active ? "none" : "auto",
          cursor: active ? "crosshair" : "auto",
        }}
      />
    </>
  );
}

/** Draws a list of strokes onto a canvas, clearing it first. */
function paint(canvas: HTMLCanvasElement, strokes: InkStroke[]) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;

    /*
      The marker behaves like a real one: wide, flat, and MULTIPLIED
      over the page so the words stay readable through the colour.
      Painting it opaque would bury the sentence it is meant to
      emphasise — which is the whole failure mode of a bad highlighter.
    */
    context.globalCompositeOperation = stroke.tool === "marker" ? "multiply" : "source-over";
    context.globalAlpha = stroke.tool === "marker" ? 0.42 : 1;
    context.strokeStyle = stroke.color;
    context.lineWidth = Math.max(1, stroke.width * canvas.width);

    context.beginPath();
    context.moveTo(stroke.points[0][0] * canvas.width, stroke.points[0][1] * canvas.height);

    /*
      Quadratic segments through the midpoints. Straight lines between
      samples make a hand-drawn curve look like a polygon, which is the
      difference between "ink" and "a chart".
    */
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const [x1, y1] = stroke.points[i];
      const [x2, y2] = stroke.points[i + 1];
      context.quadraticCurveTo(
        x1 * canvas.width,
        y1 * canvas.height,
        ((x1 + x2) / 2) * canvas.width,
        ((y1 + y2) / 2) * canvas.height
      );
    }

    const last = stroke.points[stroke.points.length - 1];
    context.lineTo(last[0] * canvas.width, last[1] * canvas.height);
    context.stroke();
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}
