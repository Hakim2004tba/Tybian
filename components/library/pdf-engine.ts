"use client";


/**
 * One place that configures PDF.js, imported by everything that needs
 * it.
 *
 * THE LEGACY BUILD, not the default one. pdfjs-dist 4.x calls
 * `Promise.withResolvers()`, which only arrived in Safari 17.4 — on the
 * Safari that ships with macOS Monterey and Big Sur it is undefined, and
 * the module throws the moment it is imported. That is not a broken PDF
 * or a broken reader: it takes down the whole page as a client-side
 * exception before anything renders, which is exactly how it presented.
 *
 * The legacy bundle is the same library with core-js polyfills compiled
 * in, for both the main thread and the worker — the worker needs its own
 * copy, since a polyfill installed on the main thread does not exist
 * inside a Worker's global scope.
 *
 * THE WORKER is the other part that breaks silently. PDF.js parses and
 * rasterises in a Web Worker, and it needs a URL to that worker's
 * script. Left unset it tries to guess one from the module's own path,
 * which does not survive Next's bundling — the viewer then either
 * blocks the main thread or fails with "Setting up fake worker", which
 * looks like a corrupt file rather than a configuration mistake.
 *
 * The file is copied into public/pdf/ by scripts/copy-pdf-worker.mjs,
 * which runs from `npm run build`. It is NOT imported: bundling a
 * worker as a module and bundling it as a worker are different things,
 * and Next resolves the import to the former.
 */
/*
  LOADED ON DEMAND, not with the route.
  --------------------------------------------------------------
  A static import put the whole library — around 126 kB of route
  JavaScript, 255 kB first load — into the bundle the browser must
  parse before the reader page shows anything at all. It is the
  heaviest route on the site by a factor of two, and none of that code
  is needed until a PDF actually opens.

  Imported here instead, once, the first time a document is opened.
  The page shell, its toolbar and the student's own highlights render
  immediately; the engine arrives while they are reading the title.
  The promise is cached so a second document does not re-import.
*/
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

export { getPdfjs };
export type PdfDocument = Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>;
export type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

/**
 * Opens a document.
 *
 * `withCredentials` matters: the file comes from our own authenticated
 * route, and PDF.js issues its range requests with plain fetch, which
 * would otherwise drop the session cookie and get a 401 for every chunk
 * after the first.
 */
export async function loadPdf(url: string) {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({
    url,
    withCredentials: true,
    /*
      Without these two, a PDF that references a standard font without
      embedding it renders with improvised glyphs at the wrong widths —
      which is not a subtle degradation: letters go missing. See
      scripts/copy-pdf-worker.mjs. Trailing slashes are required; PDF.js
      concatenates the filename straight onto these.
    */
    standardFontDataUrl: "/pdf/standard_fonts/",
    cMapUrl: "/pdf/cmaps/",
    cMapPacked: true,
    /*
      Draw glyphs as paths instead of installing the PDF's fonts as CSS
      @font-face rules — and never substitute a font installed on the
      device.
      ----------------------------------------------------------------
      The default path asks the browser's font engine to lay the text
      out. When a face fails to install, or the reader falls back to a
      local font of the same name, the ADVANCE WIDTHS stop matching the
      positions the PDF specifies, and glyphs pile onto their
      neighbours. It does not look like a font problem: it looks like
      letters are missing. "Skeleton" arrived as "Ske eton", "Tibia" as
      "T b a", "In" collapsed into what read as "h" — while the same
      letters rendered correctly elsewhere on the page, which is the
      signature of wrong metrics rather than absent glyphs.

      Rendering from the embedded font program removes the browser's
      font engine from the loop entirely: every glyph lands exactly
      where the document puts it, on every device. It costs CPU on very
      long documents. For material a student has to actually read, a
      slower page is worth more than a fast unreadable one.

      The text layer is unaffected — selection and highlighting still
      work, because that layer is built from the text content, not from
      these fonts.
    */
    disableFontFace: true,
    useSystemFonts: false,
    /*
      Both default to true and both are wrong here. Range requests are
      what make a large PDF open quickly (see the file route), and
      disabling the stream would make PDF.js buffer the whole response
      before drawing anything.
    */
    disableRange: false,
    disableStream: false,
  });
}
