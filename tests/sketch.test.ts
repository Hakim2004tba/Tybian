// Run with: node --experimental-strip-types tests/sketch.test.ts

import {
  parseDocument, documentBounds, applyRevisionMode, maskableCount,
  simplifyPoints, estimateSize, MAX_DOCUMENT_BYTES, EMPTY_DOCUMENT,
  type SketchDocument, type SketchElement,
} from "../lib/sketch/model.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

const path = (id: string, pts: [number, number][]): SketchElement =>
  ({ id, kind: "path", variant: "pen", color: "#000", width: 3, points: pts.map(([x, y]) => ({ x, y })) });
const label = (id: string, text: string, maskable: boolean): SketchElement =>
  ({ id, kind: "text", at: { x: 10, y: 10 }, text, color: "#000", width: 3, maskable });
const doc = (...els: SketchElement[]): SketchDocument => ({ version: 1, elements: els });

// --- parsing: a student's work must survive bad data -------------------
check("garbage yields an empty document", parseDocument(null), EMPTY_DOCUMENT);
check("a string yields an empty document", parseDocument("oops"), EMPTY_DOCUMENT);
check("missing elements yields empty", parseDocument({ version: 1 }).elements, []);
check("a valid path survives", parseDocument(doc(path("a", [[0, 0], [5, 5]]))).elements.length, 1);

// One malformed element must not cost the whole drawing.
const mixed = { version: 1, elements: [path("a", [[0, 0]]), { id: "bad" }, null, label("c", "x", true)] };
check("bad elements are dropped, good ones kept", parseDocument(mixed).elements.length, 2);
check("a path with no points is dropped",
  parseDocument({ version: 1, elements: [{ id: "p", kind: "path", color: "#000", width: 3, points: [] }] }).elements.length, 0);
check("a shape without endpoints is dropped",
  parseDocument({ version: 1, elements: [{ id: "s", kind: "rect", color: "#000", width: 3 }] }).elements.length, 0);

// --- revision mode: the feature this model exists for ------------------
const anatomy = doc(path("p", [[0, 0], [100, 100]]), label("t1", "Aorte", true), label("t2", "Schéma 1", false));

check("three elements before revising", applyRevisionMode(anatomy, false).elements.length, 3);
check("maskable labels are hidden while revising", applyRevisionMode(anatomy, true).elements.length, 2);
check("the drawing itself is never hidden",
  applyRevisionMode(anatomy, true).elements.some((e) => e.kind === "path"), true);
// Hiding every word would leave an unrecognisable drawing, not a test.
check("non-maskable text survives revision",
  applyRevisionMode(anatomy, true).elements.some((e) => e.kind === "text" && e.text === "Schéma 1"), true);
check("the maskable label is the one removed",
  applyRevisionMode(anatomy, true).elements.some((e) => e.kind === "text" && e.text === "Aorte"), false);
check("revising is non-destructive to the source", anatomy.elements.length, 3);
check("maskableCount counts only maskable labels", maskableCount(anatomy), 1);
check("a diagram with no labels has nothing to mask", maskableCount(doc(path("p", [[0, 0]]))), 0);

// --- bounds: previews must frame the artwork ---------------------------
check("an empty document has no bounds", documentBounds(doc()), null);
const b = documentBounds(doc(path("p", [[10, 20], [110, 220]])))!;
check("bounds cover the stroke", [b.minX < 10, b.maxX > 110, b.minY < 20, b.maxY > 220], [true, true, true, true]);
const shape = documentBounds(doc({ id: "s", kind: "rect", color: "#000", width: 4, from: { x: 0, y: 0 }, to: { x: 50, y: 30 } }))!;
check("shape bounds include stroke width", [shape.minX < 0, shape.maxX > 50], [true, true]);

// --- simplification: keeps the row small without changing the drawing --
const dense = Array.from({ length: 200 }, (_, i) => ({ x: i * 0.4, y: 0 }));
const thin = simplifyPoints(dense);
check("dense strokes are thinned", thin.length < dense.length, true);
check("the first point is kept", thin[0], dense[0]);
// Dropping the last point visibly shortens the stroke the student drew.
check("the LAST point is always kept", thin[thin.length - 1], dense[dense.length - 1]);
check("a two-point stroke is untouched",
  simplifyPoints([{ x: 0, y: 0 }, { x: 9, y: 9 }]).length, 2);
check("a single point survives", simplifyPoints([{ x: 1, y: 1 }]).length, 1);
check("widely spaced points are all kept",
  simplifyPoints([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]).length, 3);

// --- size guard --------------------------------------------------------
check("an empty document is tiny", estimateSize(EMPTY_DOCUMENT) < 100, true);
const huge = doc(path("p", Array.from({ length: 40000 }, (_, i) => [i, i] as [number, number])));
check("a runaway document exceeds the cap", estimateSize(huge) > MAX_DOCUMENT_BYTES, true);
check("a normal diagram is well under the cap",
  estimateSize(doc(path("p", Array.from({ length: 300 }, (_, i) => [i, i] as [number, number])))) < MAX_DOCUMENT_BYTES, true);

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
