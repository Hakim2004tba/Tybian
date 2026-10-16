/**
 * The ink a student lays on a page.
 *
 * Pure types and helpers — no database, no `server-only` — so the
 * canvas, the actions and any test can share one definition of what a
 * stroke is.
 *
 * COORDINATES ARE RELATIVE (0..1 of the page box), for the same reason
 * highlights are: the reader redraws at every zoom level and on every
 * screen width, and a pixel drawn on a laptop does not land in the same
 * place on a phone.
 */

export type InkTool = "pen" | "marker" | "eraser";

export type InkStroke = {
  tool: Exclude<InkTool, "eraser">;
  color: string;
  /** Fraction of page width, so the nib keeps its size at any zoom. */
  width: number;
  points: [number, number][];
};

/** The pens on the tray. Four colours each — more is a menu, not a tray. */
export const INK_COLORS = ["#1B1134", "#EF4B5F", "#2F7FE8", "#2EA86A"] as const;
export const MARKER_COLORS = ["#FDE047", "#86EFAC", "#93C5FD", "#F9A8D4"] as const;

/*
  Nib sizes as a fraction of page width, not pixels.

  A 3px pen looks right on a laptop and invisible on a phone rendering
  the same page at a third of the size. Expressing the nib in page
  units means the line is the same thickness relative to the text
  wherever it is drawn — which is what "the same pen" means.
*/
export const PEN_WIDTHS = [0.0022, 0.004, 0.007] as const;
export const MARKER_WIDTHS = [0.018, 0.028, 0.04] as const;

/**
 * Whether a point is close enough to a stroke to erase it.
 *
 * Whole strokes, not pixels. Rubbing out part of a line leaves ragged
 * fragments that look like a mistake; lifting the whole stroke is what
 * a student means by "undo that squiggle", and it keeps the stored
 * shape simple.
 */
export function strokeHit(stroke: InkStroke, x: number, y: number, radius: number): boolean {
  return stroke.points.some(([px, py]) => Math.hypot(px - x, py - y) <= radius + stroke.width);
}

/** Safe parse for what comes back from the database. */
export function parseStrokes(value: unknown): InkStroke[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((s): s is InkStroke => {
    if (!s || typeof s !== "object") return false;
    const stroke = s as Record<string, unknown>;
    return (
      (stroke.tool === "pen" || stroke.tool === "marker") &&
      typeof stroke.color === "string" &&
      typeof stroke.width === "number" &&
      Array.isArray(stroke.points)
    );
  });
}
