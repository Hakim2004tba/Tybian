/**
 * The drawing document model.
 *
 * Pure and dependency-free so the geometry and the revision-mode rules
 * are unit-testable without a canvas (tests/sketch.test.ts) — the same
 * lib/study/* split used elsewhere in this project.
 */

export const SKETCH_VERSION = 1;

export type Point = { x: number; y: number };

export type Tool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  /** Moves the surface rather than drawing on it — the touch-friendly
   *  way to pan when there is no middle mouse button. */
  | "pan";

export type BaseElement = {
  id: string;
  color: string;
  width: number;
};

export type PathElement = BaseElement & {
  kind: "path";
  /** "highlighter" is drawn translucent and thick, under the ink. */
  variant: "pen" | "highlighter";
  points: Point[];
};

export type ShapeElement = BaseElement & {
  kind: "line" | "arrow" | "rect" | "ellipse";
  from: Point;
  to: Point;
};

export type TextElement = BaseElement & {
  kind: "text";
  at: Point;
  text: string;
  /**
   * THE REVISION FEATURE. A label the student wants to test themselves
   * on — hidden in revision mode, revealed on demand. This is why text
   * stays a discrete object rather than being drawn into pixels.
   */
  maskable: boolean;
};

export type SketchElement = PathElement | ShapeElement | TextElement;

export type SketchDocument = {
  version: number;
  elements: SketchElement[];
};

export const EMPTY_DOCUMENT: SketchDocument = { version: SKETCH_VERSION, elements: [] };

/** Medical-diagram palette: ink, artery, vein, nerve, highlight, plus a
 *  neutral. Named so the toolbar can label them rather than showing
 *  seven anonymous swatches. */
export const PALETTE = [
  /* `key` indexes dict.sketch.colors — the anatomical naming (arterial,
     venous, neural) is the point of this palette, so it has to read in
     the student's own language. */
  { hex: "#1B1134", key: "ink" },
  { hex: "#E23D3D", key: "arterial" },
  { hex: "#2B6CE0", key: "venous" },
  { hex: "#12A150", key: "neural" },
  { hex: "#6C4CF1", key: "violet" },
  { hex: "#E8B84B", key: "highlight" },
] as const;

/**
 * Parses whatever came out of the database into a document we can draw.
 *
 * Deliberately forgiving: a sketch is the student's own work, and a
 * single malformed element must not cost them the whole drawing. Bad
 * elements are dropped, the rest is kept.
 */
export function parseDocument(raw: unknown): SketchDocument {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DOCUMENT };

  const doc = raw as Partial<SketchDocument>;
  const elements = Array.isArray(doc.elements) ? doc.elements : [];

  const valid = elements.filter((el): el is SketchElement => {
    if (!el || typeof el !== "object") return false;
    const e = el as SketchElement;
    if (typeof e.id !== "string" || typeof e.color !== "string") return false;

    if (e.kind === "path") return Array.isArray(e.points) && e.points.length > 0;
    if (e.kind === "text") return typeof e.text === "string" && !!e.at;
    if (e.kind === "line" || e.kind === "arrow" || e.kind === "rect" || e.kind === "ellipse") {
      return !!e.from && !!e.to;
    }
    return false;
  });

  return { version: typeof doc.version === "number" ? doc.version : SKETCH_VERSION, elements: valid };
}

/**
 * Bounding box of everything drawn. Used to fit gallery previews to the
 * artwork instead of showing a mostly-empty canvas — a thumbnail of a
 * small diagram floating in a sea of white is unreadable at 160px.
 * Returns null for an empty document, so callers render a placeholder
 * rather than dividing by a zero-sized box.
 */
export function documentBounds(
  doc: SketchDocument
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (p: Point, pad = 0) => {
    minX = Math.min(minX, p.x - pad);
    minY = Math.min(minY, p.y - pad);
    maxX = Math.max(maxX, p.x + pad);
    maxY = Math.max(maxY, p.y + pad);
  };

  for (const el of doc.elements) {
    if (el.kind === "path") {
      for (const p of el.points) include(p, el.width / 2);
    } else if (el.kind === "text") {
      // Text is anchored at its baseline start; approximate the box it
      // occupies so a label near the edge is not cropped out of preview.
      include(el.at, 0);
      include({ x: el.at.x + el.text.length * el.width * 0.6, y: el.at.y - el.width }, 0);
    } else {
      include(el.from, el.width / 2);
      include(el.to, el.width / 2);
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * What to draw in revision mode: maskable labels are removed, the
 * diagram itself stays. The student re-labels from memory, then reveals.
 *
 * Non-maskable text (titles, a legend, notes to self) survives — hiding
 * every word would leave an unrecognisable drawing rather than a test.
 */
export function applyRevisionMode(doc: SketchDocument, revising: boolean): SketchDocument {
  if (!revising) return doc;
  return {
    ...doc,
    elements: doc.elements.filter((el) => !(el.kind === "text" && el.maskable)),
  };
}

/** How many labels revision mode would hide — the UI disables the mode
 *  when the answer is zero rather than offering a button that appears
 *  to do nothing. */
export function maskableCount(doc: SketchDocument): number {
  return doc.elements.filter((el) => el.kind === "text" && el.maskable).length;
}

/**
 * Drops points that add nothing to the shape of a stroke.
 *
 * Pointer events fire far faster than the hand moves, so a raw stroke
 * carries hundreds of near-identical points. Left alone, a page of
 * diagrams becomes a megabyte of JSON in the row and a slow redraw.
 * Distance-based thinning keeps the curve visually identical.
 */
export function simplifyPoints(points: Point[], minDistance = 2): Point[] {
  if (points.length <= 2) return points;

  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    const dx = points[i].x - last.x;
    const dy = points[i].y - last.y;
    if (Math.hypot(dx, dy) >= minDistance) out.push(points[i]);
  }
  // The final point always survives: dropping it visibly shortens the
  // stroke the student just drew.
  out.push(points[points.length - 1]);
  return out;
}

/** Rough byte size, used to refuse a save that would bloat the row
 *  rather than failing opaquely at the database. */
export function estimateSize(doc: SketchDocument): number {
  return JSON.stringify(doc).length;
}

export const MAX_DOCUMENT_BYTES = 400_000;
