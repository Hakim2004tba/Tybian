import { copyFile, cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies the PDF.js worker into public/pdf/ so the reader can point at
 * a stable URL.
 *
 * Runs from `npm run build` rather than being committed, so the worker
 * can never drift from the pdfjs-dist version in package-lock.json — a
 * mismatched pair fails at runtime with an unhelpful version error.
 *
 * fileURLToPath, not a bare path: this project's directory contains a
 * space, and the URL form of it carries %20 into any path built by
 * concatenation.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/* legacy/, matching components/library/pdf-engine.ts — the polyfilled
   worker, for the Safari versions that lack Promise.withResolvers. */
const source = join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs");
const targetDir = join(root, "public", "pdf");

await mkdir(targetDir, { recursive: true });
await copyFile(source, join(targetDir, "pdf.worker.min.mjs"));

/*
  The standard fonts, and why a PDF is unreadable without them.

  A PDF may reference one of the 14 standard fonts (Helvetica, Times,
  Courier ...) without embedding it, on the assumption that the reader
  has them. A browser does not. PDF.js ships substitutes, but only loads
  them from a URL it is given — with none configured it renders those
  pages with whatever it can improvise, and the glyph widths no longer
  match the positions the PDF specifies. Narrow letters are what breaks
  first: "Skeleton" came out as "Ske eton", "Tibia" as "T b a".

  cmaps are the same bargain for multi-byte encodings — a scanned or
  non-Latin document maps its character codes through them.

  Copied at build time rather than committed, so they can never drift
  from the pdfjs-dist version that reads them.
*/
await cp(join(root, "node_modules", "pdfjs-dist", "standard_fonts"), join(targetDir, "standard_fonts"), {
  recursive: true,
});
await cp(join(root, "node_modules", "pdfjs-dist", "cmaps"), join(targetDir, "cmaps"), {
  recursive: true,
});

console.log("pdf worker, standard fonts and cmaps copied to public/pdf/");
