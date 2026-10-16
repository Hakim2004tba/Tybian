"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pen, Highlighter, Eraser, Minus, ArrowRight, Square, Circle, Type,
  Undo2, Save, X, Eye, EyeOff, Trash2, Plus, PanelsTopLeft, Hand, Maximize2,
} from "lucide-react";
import {
  EMPTY_DOCUMENT, PALETTE, applyRevisionMode, maskableCount,
  type Point, type SketchDocument, type Tool,
} from "@/lib/sketch/model";
import { SketchCanvas, DEFAULT_VIEWPORT, type Viewport } from "@/components/sketch/SketchCanvas";
import { SketchPreview } from "@/components/sketch/SketchPreview";
import { saveSketchAction, deleteSketchAction } from "@/lib/actions/sketches";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

type StoredSketch = {
  id: string;
  title: string;
  contextLabel: string | null;
  updatedAt: string;
  document: SketchDocument;
};

type ToolKey = "pen" | "highlight" | "arrow" | "line" | "rect" | "circle" | "text" | "eraser" | "pan";

const TOOLS: { tool: Tool; icon: typeof Pen; key: ToolKey }[] = [
  /* `key` indexes dict.sketch, so each tool names itself in whichever
     language the reader chose. */
  { tool: "pen", icon: Pen, key: "pen" },
  { tool: "highlighter", icon: Highlighter, key: "highlight" },
  { tool: "arrow", icon: ArrowRight, key: "arrow" },
  { tool: "line", icon: Minus, key: "line" },
  { tool: "rect", icon: Square, key: "rect" },
  { tool: "ellipse", icon: Circle, key: "circle" },
  { tool: "text", icon: Type, key: "text" },
  { tool: "eraser", icon: Eraser, key: "eraser" },
  { tool: "pan", icon: Hand, key: "pan" },
];

/** Stroke widths, with names — four near-identical dots gave no clue
 *  which was which, and the difference between 2px and 3px is invisible
 *  in a 28px button. */
const WIDTHS: { value: number; key: "thin" | "normal" | "bold" | "thick" }[] = [
  { value: 2, key: "thin" },
  { value: 4, key: "normal" },
  { value: 7, key: "bold" },
  { value: 12, key: "thick" },
];

/**
 * Full-screen drawing studio.
 *
 * Full screen rather than a floating panel because drawing needs room:
 * a 380px popover is fine for chatting and useless for a mechanism
 * diagram. It opens over everything and closes back to where the
 * student was.
 *
 * Two things make this more than a canvas:
 *  - saved sketches are DOCUMENTS, so they reopen editable months later
 *  - revision mode hides the labels the student marked, turning any
 *    diagram into a self-test — the reason text stays a real object
 */
export function SketchStudio({
  initialSketches,
  contextLabel,
  onClose,
}: {
  initialSketches: StoredSketch[];
  contextLabel: string | null;
  onClose: () => void;
}) {
  const { t: T } = useI18n();
  const t = T.sketch;
  const [sketches, setSketches] = useState(initialSketches);
  const [view, setView] = useState<"gallery" | "editor">(
    initialSketches.length > 0 ? "gallery" : "editor"
  );

  const [id, setId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<SketchDocument>({ ...EMPTY_DOCUMENT });
  const [history, setHistory] = useState<SketchDocument[]>([]);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(PALETTE[0].hex);
  const [width, setWidth] = useState(3);
  const [revising, setRevising] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<{ world: Point; screen: Point } | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingText) textInputRef.current?.focus();
  }, [pendingText]);

  // Escape closes the studio — expected of anything full-screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pendingText) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pendingText]);

  function update(next: SketchDocument) {
    // Bounded history: keeping every state of a long drawing session
    // would grow without limit for a feature nobody uses 40 steps deep.
    setHistory((h) => [...h.slice(-39), doc]);
    setDoc(next);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      setDoc(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function openSketch(s: StoredSketch) {
    setId(s.id);
    setTitle(s.title);
    setDoc(s.document);
    setHistory([]);
    setRevising(false);
    setViewport(DEFAULT_VIEWPORT);
    setView("editor");
  }

  function newSketch() {
    setId(undefined);
    setTitle("");
    setDoc({ ...EMPTY_DOCUMENT });
    setHistory([]);
    setRevising(false);
    setViewport(DEFAULT_VIEWPORT);
    setView("editor");
  }

  function commitText(text: string) {
    const at = pendingText?.world;
    setPendingText(null);
    if (!at || !text.trim()) return;

    update({
      ...doc,
      elements: [
        ...doc.elements,
        {
          id: crypto.randomUUID(),
          kind: "text",
          at,
          text: text.trim(),
          color,
          width,
          // Labels default to maskable: on a medical diagram that is
          // almost always what a label is for, and the student can turn
          // it off per label if it is a title rather than an answer.
          maskable: true,
        },
      ],
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveSketchAction({
      id,
      title: title.trim() || t.untitled,
      content: doc,
      contextLabel: id ? undefined : contextLabel,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const savedId = result.id!;
    setId(savedId);
    const entry: StoredSketch = {
      id: savedId,
      title: title.trim() || t.untitled,
      contextLabel: contextLabel,
      updatedAt: new Date().toISOString(),
      document: doc,
    };
    setSketches((list) => [entry, ...list.filter((s) => s.id !== savedId)]);
  }

  async function remove(sketchId: string) {
    if (!window.confirm(t.confirmDelete)) return;
    const res = await deleteSketchAction(sketchId);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSketches((list) => list.filter((s) => s.id !== sketchId));
    if (id === sketchId) newSketch();
  }

  const masks = maskableCount(doc);
  const shown = applyRevisionMode(doc, revising);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-academy-lavender print:hidden">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-academy-lavender-deep bg-academy-deep px-4 py-2.5">
        <div className="flex items-center gap-2 text-white">
          <PanelsTopLeft size={17} className="text-secondary" />
          <span className="text-[14px] font-bold">{t.title}</span>
        </div>

        {view === "editor" && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
            className="h-8 w-48 rounded-md border border-white/20 bg-white/10 px-2.5 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-secondary"
          />
        )}

        {contextLabel && view === "editor" && !id && (
          <span className="hidden truncate rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] text-white/70 sm:inline">
            {contextLabel}
          </span>
        )}

        <div className="mr-auto flex items-center gap-2">
          {view === "editor" && (
            <>
              <button
                type="button"
                onClick={() => setRevising((v) => !v)}
                disabled={masks === 0}
                title={masks === 0 ? t.needLabels : t.hideLabels}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors disabled:opacity-35",
                  revising ? "bg-secondary text-academy-deep" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {revising ? <Eye size={14} /> : <EyeOff size={14} />}
                {revising ? t.reveal : `${t.reviewShort} (${masks})`}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? t.saving : t.save}
              </button>
              <button
                type="button"
                onClick={() => setView("gallery")}
                className="rounded-md bg-white/10 px-3 py-1.5 text-[12.5px] text-white hover:bg-white/20"
              >
                {t.mySketches}
              </button>
            </>
          )}
          {view === "gallery" && (
            <button
              type="button"
              onClick={newSketch}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-primary-hover"
            >
              <Plus size={14} />
              {t.newSketch}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {error && (
        <p className="border-b border-error/30 bg-error/10 px-4 py-2 text-[12.5px] text-error">{error}</p>
      )}

      {view === "gallery" ? (
        <div className="flex-1 overflow-y-auto p-4">
          {sketches.length === 0 ? (
            <div className="mx-auto mt-16 max-w-sm text-center">
              <PanelsTopLeft size={30} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] text-text-secondary-light">{t.empty}</p>
              <p className="mt-1 text-[12.5px] text-text-muted-light">
                {t.intro}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sketches.map((s) => (
                <div
                  key={s.id}
                  className="group overflow-hidden rounded-xl border border-white/70 bg-paper transition-shadow hover:shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => openSketch(s)}
                    className="block w-full"
                    aria-label={`${t.open} ${s.title}`}
                  >
                    <SketchPreview document={s.document} className="h-36 w-full bg-paper" />
                  </button>
                  <div className="flex items-start gap-2 border-t border-academy-lavender px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-text-primary-light">{s.title}</p>
                      {s.contextLabel && (
                        <p className="truncate text-[11.5px] text-text-muted-light">{s.contextLabel}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      aria-label={t.delete}
                      className="rounded-sm p-1 text-text-muted-light opacity-0 transition-opacity hover:bg-error/10 hover:text-error group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 lg:flex-row">
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-white/70 bg-white px-3 py-2 lg:w-16 lg:flex-col lg:items-stretch lg:py-3">
            <div className="flex flex-wrap gap-1 lg:flex-col">
              {TOOLS.map((item) => (
                <button
                  key={item.tool}
                  type="button"
                  onClick={() => setTool(item.tool)}
                  title={t[item.key]}
                  aria-label={t[item.key]}
                  aria-pressed={tool === item.tool}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    tool === item.tool
                      ? "bg-primary text-white"
                      : "text-text-secondary-light hover:bg-academy-lavender-soft hover:text-primary"
                  )}
                >
                  <item.icon size={17} />
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-academy-lavender lg:h-px lg:w-full" aria-hidden="true" />

            <div className="flex flex-wrap gap-1 lg:flex-col lg:items-center">
              {PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={t.colors[c.key]}
                  aria-label={t.colors[c.key]}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c.hex ? "scale-110 border-academy-deep" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="h-6 w-px bg-academy-lavender lg:h-px lg:w-full" aria-hidden="true" />

            <div className="flex items-center gap-1 lg:flex-col">
              {WIDTHS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setWidth(w.value)}
                  title={t[w.key]}
                  aria-label={t[w.key]}
                  aria-pressed={width === w.value}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                    width === w.value
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-academy-lavender-soft"
                  )}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: w.value + 3,
                      height: w.value + 3,
                      backgroundColor: width === w.value ? "#6C4CF1" : "#1B1134",
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-academy-lavender lg:h-px lg:w-full" aria-hidden="true" />

            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              aria-label={t.undo}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary-light transition-colors hover:bg-academy-lavender-soft hover:text-primary disabled:opacity-30"
            >
              <Undo2 size={17} />
            </button>
          </div>

          {/* Surface */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/70 bg-paper">
            <SketchCanvas
              document={shown}
              onChange={update}
              tool={tool}
              color={color}
              width={width}
              readOnly={revising}
              viewport={viewport}
              onViewportChange={setViewport}
              onRequestText={(world, screen) => setPendingText({ world, screen })}
            />

            {/* Zoom readout + reset. Without a way back, a student who
                zooms far out on an infinite surface has no landmark to
                return to. */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-paper/95 px-1.5 py-1 shadow ring-1 ring-academy-lavender-deep">
              <button
                type="button"
                onClick={() => setViewport((v) => ({ ...v, scale: Math.max(0.15, v.scale / 1.25) }))}
                aria-label={t.zoomOut}
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary-light hover:bg-academy-lavender-soft"
              >
                <Minus size={14} />
              </button>
              <span className="num w-11 text-center text-[11.5px] text-text-secondary-light">
                {Math.round(viewport.scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setViewport((v) => ({ ...v, scale: Math.min(6, v.scale * 1.25) }))}
                aria-label={t.zoomIn}
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary-light hover:bg-academy-lavender-soft"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewport(DEFAULT_VIEWPORT)}
                aria-label={t.reset}
                title={t.reset}
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary-light hover:bg-academy-lavender-soft"
              >
                <Maximize2 size={13} />
              </button>
            </div>

            {revising && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <span className="rounded-full bg-academy-deep/90 px-3.5 py-1.5 text-[12px] text-white">
                  {t.reviewMode}
                </span>
              </div>
            )}

            {pendingText && (
              <div
                className="absolute z-10 flex items-center gap-1.5 rounded-lg border border-primary bg-paper p-1.5 shadow-lg"
                style={{
                  left: Math.max(4, pendingText.screen.x - 8),
                  top: Math.max(4, pendingText.screen.y - 34),
                }}
              >
                <input
                  ref={textInputRef}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitText((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setPendingText(null);
                  }}
                  placeholder={t.labelPlaceholder}
                  className="h-8 w-40 rounded-md border border-academy-lavender-deep px-2 text-[13px] outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => commitText(textInputRef.current?.value ?? "")}
                  className="rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-white"
                >
                  {t.add}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
