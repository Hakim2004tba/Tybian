import type { SketchDocument, SketchElement, Point } from "@/lib/sketch/model";

/**
 * Canvas painting, shared by the editor and the gallery previews.
 *
 * One renderer for both is the point: a thumbnail that draws differently
 * from the editor is a thumbnail that lies about what the student saved.
 */

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = Math.max(8, size * 3);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

export function drawElement(ctx: CanvasRenderingContext2D, el: SketchElement) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.kind === "path") {
    if (el.variant === "highlighter") {
      // Translucent and multiplied so overlapping passes darken like a
      // real marker instead of stacking into opaque blocks.
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = "multiply";
    }

    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);

    if (el.points.length === 1) {
      // A tap with no movement: draw a dot, or nothing appears at all.
      ctx.lineTo(el.points[0].x + 0.01, el.points[0].y);
    } else {
      // Quadratic midpoints smooth the polyline into a hand-drawn curve
      // rather than the visible faceting of straight segments.
      for (let i = 1; i < el.points.length - 1; i++) {
        const mid = {
          x: (el.points[i].x + el.points[i + 1].x) / 2,
          y: (el.points[i].y + el.points[i + 1].y) / 2,
        };
        ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, mid.x, mid.y);
      }
      const last = el.points[el.points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  } else if (el.kind === "text") {
    ctx.font = `${Math.max(12, el.width * 6)}px system-ui, sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(el.text, el.at.x, el.at.y);
  } else if (el.kind === "rect") {
    ctx.strokeRect(el.from.x, el.from.y, el.to.x - el.from.x, el.to.y - el.from.y);
  } else if (el.kind === "ellipse") {
    const cx = (el.from.x + el.to.x) / 2;
    const cy = (el.from.y + el.to.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(el.to.x - el.from.x) / 2, Math.abs(el.to.y - el.from.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(el.from.x, el.from.y);
    ctx.lineTo(el.to.x, el.to.y);
    ctx.stroke();
    if (el.kind === "arrow") drawArrowHead(ctx, el.from, el.to, el.width);
  }

  ctx.restore();
}

export function drawDocument(ctx: CanvasRenderingContext2D, doc: SketchDocument) {
  // Highlighter first so ink always sits on top — the order a real
  // marker and pen produce on paper.
  const highlights = doc.elements.filter((e) => e.kind === "path" && e.variant === "highlighter");
  const rest = doc.elements.filter((e) => !(e.kind === "path" && e.variant === "highlighter"));
  for (const el of highlights) drawElement(ctx, el);
  for (const el of rest) drawElement(ctx, el);
}
