"use client";

import { useEffect, useRef } from "react";
import { documentBounds, type SketchDocument } from "@/lib/sketch/model";
import { drawDocument } from "@/lib/sketch/render";

/**
 * A gallery thumbnail, drawn from the same stroke data and the same
 * renderer as the editor — so the preview can never disagree with what
 * opening the sketch shows.
 *
 * The view is fitted to the artwork's bounding box rather than to the
 * original canvas: a small diagram drawn in one corner would otherwise
 * be an almost-empty white square at this size.
 */
export function SketchPreview({ document: doc, className }: { document: SketchDocument; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const bounds = documentBounds(doc);
    if (!bounds) return;

    const pad = 12;
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);
    // `min` keeps the aspect ratio; capped at 1 so a two-stroke sketch is
    // not blown up into unreadable slabs.
    const scale = Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h, 1);

    ctx.translate(
      pad + (rect.width - pad * 2 - w * scale) / 2 - bounds.minX * scale,
      pad + (rect.height - pad * 2 - h * scale) / 2 - bounds.minY * scale
    );
    ctx.scale(scale, scale);

    drawDocument(ctx, doc);
  }, [doc]);

  return <canvas ref={ref} className={className} />;
}
