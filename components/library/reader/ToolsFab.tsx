"use client";

import { Pen, Highlighter, Eraser, Undo2, X, PencilRuler } from "lucide-react";
import { INK_COLORS, MARKER_COLORS, PEN_WIDTHS, MARKER_WIDTHS, type InkTool } from "@/lib/library/ink";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The study tools, behind one circle.
 *
 * Closed it is a single button, the same size and shape as the AI one
 * beside it. Open it is a tray: pen, highlighter, eraser, the colours
 * for whichever is chosen, three nib sizes, and undo.
 *
 * ONE TAP ARMS THE TOOL. Choosing the highlighter means the next drag
 * across the page highlights — there is no "apply", no confirm, and no
 * second menu. Picking a colour keeps the tool armed and changes the
 * ink, because that is what picking a colour means when a pen is
 * already in your hand.
 *
 * The tray only ever shows the colours of the ARMED tool. Showing both
 * sets at once doubles the row and makes the student read it; a pen is
 * four dark colours and a marker is four bright ones, and no one needs
 * to see the other four.
 */
/*
  POSITIONED INSIDE THE READER, not against the viewport.

  `fixed` put the circle wherever the screen happened to end, which on
  a phone landed it on top of the bottom navigation and on a desktop
  floated it over the sidebar. The tools belong to the document, so
  they are anchored to the document's own box (the reader root is
  `relative`) and can never wander onto another part of the app.
*/
export function ToolsFab({
  open,
  onOpen,
  tool,
  color,
  width,
  onTool,
  onColor,
  onWidth,
  onUndo,
  canUndo,
  offsetClass,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  tool: InkTool | null;
  color: string;
  width: number;
  onTool: (tool: InkTool | null) => void;
  onColor: (color: string) => void;
  onWidth: (width: number) => void;
  onUndo: () => void;
  canUndo: boolean;
  offsetClass: string;
}) {
  const { t } = useI18n();
  const labels = t.library;

  const palette = tool === "marker" ? MARKER_COLORS : INK_COLORS;
  const widths = tool === "marker" ? MARKER_WIDTHS : PEN_WIDTHS;

  return (
    <>
      {/* The trigger — twin of the AI button, so the pair reads as one
          family of floating tools rather than two unrelated buttons. */}
      <button
        type="button"
        onClick={() => onOpen(!open)}
        aria-label={labels.tools}
        aria-expanded={open}
        className={cn(
          "absolute z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-6px_rgba(108,76,241,0.65)] transition-transform active:scale-95 print:hidden",
          offsetClass,
          tool
            ? "bg-gradient-to-br from-[#E8A33D] to-[#C97A22]"
            : "bg-gradient-to-br from-primary to-secondary"
        )}
      >
        {open ? <X size={22} /> : tool ? <ActiveIcon tool={tool} /> : <PencilRuler size={21} />}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-40 flex flex-col gap-2 rounded-3xl border border-black/5 bg-white/95 p-2 shadow-[0_18px_50px_-12px_rgba(23,15,46,0.45)] backdrop-blur-xl print:hidden",
            /* Sits directly above the trigger, so the thumb travels the
               shortest distance from "open" to "choose". */
            offsetClass,
            "mb-[4.75rem]"
          )}
          style={{ marginBottom: "4.75rem" }}
        >
          <div className="flex items-center gap-1.5">
            <Tool
              label={labels.pen}
              active={tool === "pen"}
              onClick={() => onTool(tool === "pen" ? null : "pen")}
            >
              <Pen size={19} />
            </Tool>
            <Tool
              label={labels.marker}
              active={tool === "marker"}
              onClick={() => onTool(tool === "marker" ? null : "marker")}
            >
              <Highlighter size={19} />
            </Tool>
            <Tool
              label={labels.eraser}
              active={tool === "eraser"}
              onClick={() => onTool(tool === "eraser" ? null : "eraser")}
            >
              <Eraser size={19} />
            </Tool>
            <Tool label={labels.undo} onClick={onUndo} disabled={!canUndo}>
              <Undo2 size={19} />
            </Tool>
          </div>

          {/* Colours and nib sizes appear only once something can draw.
              An eraser has no colour, and showing a palette for it would
              be an invitation to a setting that does nothing. */}
          {tool && tool !== "eraser" && (
            <>
              <div className="flex items-center gap-1.5 px-0.5">
                {palette.map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => onColor(swatch)}
                    aria-label={swatch}
                    className={cn(
                      "h-9 w-9 rounded-full ring-1 ring-black/10 transition active:scale-90",
                      color === swatch && "ring-[3px] ring-primary"
                    )}
                    style={{ background: swatch }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 px-0.5 pb-0.5">
                {widths.map((value) => (
                  <button
                    key={value}
                    onClick={() => onWidth(value)}
                    aria-label={String(value)}
                    className={cn(
                      "flex h-8 w-11 items-center justify-center rounded-xl transition",
                      width === value ? "bg-primary/12" : "hover:bg-black/5"
                    )}
                  >
                    <span
                      className="block rounded-full bg-text-primary-light"
                      style={{
                        width: Math.max(4, value * 700),
                        height: Math.max(4, value * 700),
                      }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ActiveIcon({ tool }: { tool: InkTool }) {
  if (tool === "marker") return <Highlighter size={21} />;
  if (tool === "eraser") return <Eraser size={21} />;
  return <Pen size={21} />;
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        /* 44px targets throughout — this tray is used with a thumb or a
           pen, never a mouse pointer. */
        "flex h-11 w-11 items-center justify-center rounded-2xl transition active:scale-90 disabled:opacity-25",
        active ? "bg-primary text-white" : "text-text-secondary-light hover:bg-black/5"
      )}
    >
      {children}
    </button>
  );
}
