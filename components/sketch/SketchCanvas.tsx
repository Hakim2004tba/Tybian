"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  simplifyPoints,
  type Point,
  type SketchDocument,
  type SketchElement,
  type Tool,
} from "@/lib/sketch/model";
import { drawDocument, drawElement } from "@/lib/sketch/render";

/**
 * The drawing surface.
 *
 * POINTER EVENTS, not mouse events: medical students draw on tablets
 * with a stylus, and a mouse-only handler would make the whole feature
 * useless on exactly the device it is best on. Pointer events cover
 * mouse, touch and pen through one path, and `touch-action: none` stops
 * the browser scrolling the page while a stroke is being drawn.
 *
 * The canvas is sized in CSS pixels but backed at devicePixelRatio, or
 * every line looks soft on the retina screens these students use.
 *
 * THE SURFACE IS INFINITE. Everything is stored in world coordinates and
 * painted through a pan/zoom transform, so a diagram is never limited by
 * the size of the window it was started in — the student can keep going
 * in any direction and zoom in to add detail. Pointer positions are
 * converted from screen space to world space before anything is
 * recorded, which is what keeps strokes anchored to the drawing rather
 * than to the viewport.
 */
export type Viewport = { x: number; y: number; scale: number };

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export function SketchCanvas({
  document: doc,
  onChange,
  tool,
  color,
  width,
  readOnly = false,
  onRequestText,
  viewport,
  onViewportChange,
}: {
  document: SketchDocument;
  onChange: (next: SketchDocument) => void;
  tool: Tool;
  color: string;
  width: number;
  readOnly?: boolean;
  onRequestText?: (at: Point, screenAt: Point) => void;
  viewport: Viewport;
  onViewportChange: (next: Viewport) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drafting, setDrafting] = useState<SketchElement | null>(null);
  const drawingRef = useRef(false);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    // A faint grid, drawn in world space, so panning and zooming feel
    // like moving over a surface instead of dragging content around in
    // a void with no reference points.
    drawGrid(ctx, canvas, dpr, viewport);

    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);

    drawDocument(ctx, doc);
    // The in-progress element is painted on top but never committed
    // until the pointer lifts, so an abandoned stroke leaves no trace.
    if (drafting) drawElement(ctx, drafting);
  }, [doc, drafting, viewport]);

  // Keep the backing store in step with the element's CSS size.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      repaint();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [repaint]);

  useEffect(repaint, [repaint]);

  /** Screen pixels -> world coordinates. Everything stored goes through
   *  here, so a stroke drawn at 3x zoom lands where the student saw it. */
  function pointFrom(e: React.PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - viewport.x) / viewport.scale,
      y: (e.clientY - rect.top - viewport.y) / viewport.scale,
    };
  }

  function screenPointFrom(e: React.PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Zoom about the cursor, not the origin — zooming toward a corner
   *  the student is not looking at makes the surface feel uncontrollable. */
  function onWheel(e: React.WheelEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const factor = Math.exp(-e.deltaY * 0.0015);
    const scale = Math.min(6, Math.max(0.15, viewport.scale * factor));
    const k = scale / viewport.scale;

    onViewportChange({
      scale,
      x: cx - (cx - viewport.x) * k,
      y: cy - (cy - viewport.y) * k,
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    // Middle mouse, space-drag and the pan tool all move the surface —
    // and panning stays available in read-only revision mode, where the
    // student still needs to move around a large diagram.
    if (e.button === 1 || tool === "pan" || readOnly) {
      const s = screenPointFrom(e);
      panRef.current = { startX: s.x, startY: s.y, originX: viewport.x, originY: viewport.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const at = pointFrom(e);

    if (tool === "text") {
      onRequestText?.(at, screenPointFrom(e));
      return;
    }

    if (tool === "eraser") {
      eraseAt(at);
      drawingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    const id = crypto.randomUUID();
    if (tool === "pen" || tool === "highlighter") {
      setDrafting({
        id,
        kind: "path",
        variant: tool,
        color,
        width: tool === "highlighter" ? width * 4 : width,
        points: [at],
      });
    } else {
      setDrafting({ id, kind: tool, color, width, from: at, to: at });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const s = screenPointFrom(e);
      onViewportChange({
        ...viewport,
        x: panRef.current.originX + (s.x - panRef.current.startX),
        y: panRef.current.originY + (s.y - panRef.current.startY),
      });
      return;
    }

    if (!drawingRef.current || readOnly) return;
    const at = pointFrom(e);

    if (tool === "eraser") {
      eraseAt(at);
      return;
    }

    setDrafting((prev) => {
      if (!prev) return prev;
      if (prev.kind === "path") return { ...prev, points: [...prev.points, at] };
      return { ...prev, to: at };
    });
  }

  function onPointerUp() {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;

    setDrafting((prev) => {
      if (!prev) return null;

      if (prev.kind === "path") {
        // Thin the stroke once, at commit time: doing it per move event
        // would fight the smoothing while the hand is still moving.
        const points = simplifyPoints(prev.points);
        onChange({ ...doc, elements: [...doc.elements, { ...prev, points }] });
      } else if (prev.kind !== "text") {
        // A click with no drag would store a zero-size shape the student
        // can see nothing of but which still counts against the size cap.
        const dragged = Math.hypot(prev.to.x - prev.from.x, prev.to.y - prev.from.y) > 3;
        if (dragged) onChange({ ...doc, elements: [...doc.elements, prev] });
      }

      return null;
    });
  }

  /** Whole-element eraser rather than pixel rubbing: strokes are objects,
   *  so removing the one under the cursor is both what the student means
   *  and what keeps the document editable. */
  function eraseAt(at: Point) {
    const HIT = 12 / viewport.scale;
    const survivors = doc.elements.filter((el) => {
      if (el.kind === "path") {
        return !el.points.some((p) => Math.hypot(p.x - at.x, p.y - at.y) < HIT + el.width);
      }
      if (el.kind === "text") {
        return !(Math.abs(el.at.x - at.x) < 80 && Math.abs(el.at.y - at.y) < 24);
      }
      const minX = Math.min(el.from.x, el.to.x) - HIT;
      const maxX = Math.max(el.from.x, el.to.x) + HIT;
      const minY = Math.min(el.from.y, el.to.y) - HIT;
      const maxY = Math.max(el.from.y, el.to.y) + HIT;
      return !(at.x > minX && at.x < maxX && at.y > minY && at.y < maxY);
    });

    if (survivors.length !== doc.elements.length) onChange({ ...doc, elements: survivors });
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        /*
          bg-paper, not bg-white. This canvas is the sheet: its grid is
          painted at a fixed #EEECF2 and the default ink is near-black,
          both chosen for white paper. The dark-mode override on
          `.bg-white` turned the sheet itself dark and left dark ink on
          it. Fixing the container behind it changed nothing, because
          this element covers the container completely.
        */
        className="h-full w-full rounded-lg bg-paper"
        style={{
          touchAction: "none",
          cursor:
            readOnly || tool === "pan" ? "grab" : tool === "eraser" ? "cell" : "crosshair",
        }}
      />
    </div>
  );
}

/**
 * The background grid. Drawn in screen space from the world transform so
 * the spacing stays readable at every zoom level — a grid that scales
 * with the drawing becomes either invisible or a solid block.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dpr: number,
  viewport: Viewport
) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  // Step up the spacing as the student zooms out, so the grid never
  // collapses into noise.
  let step = 24 * viewport.scale;
  while (step < 14) step *= 4;
  while (step > 90) step /= 4;

  const offsetX = ((viewport.x % step) + step) % step;
  const offsetY = ((viewport.y % step) + step) % step;

  ctx.save();
  ctx.strokeStyle = "#EEECF2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offsetX; x < w; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = offsetY; y < h; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}
