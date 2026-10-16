"use client";

import { StickyNote, Sparkles, X } from "lucide-react";
import type { Highlight } from "@/lib/data/library";
import { useI18n } from "@/lib/i18n/I18nProvider";

const COLORS: { key: Highlight["color"]; swatch: string }[] = [
  { key: "yellow", swatch: "bg-[#FDE047]" },
  { key: "green", swatch: "bg-[#86EFAC]" },
  { key: "blue", swatch: "bg-[#93C5FD]" },
  { key: "pink", swatch: "bg-[#F9A8D4]" },
];

/**
 * The bar that appears the moment text is selected.
 *
 * THE WHOLE POINT IS THAT IT HAS NO STEPS. A colour circle IS the
 * highlight — tapping yellow highlights in yellow and the bar is gone.
 * There is no "choose a colour" state, no confirm, no menu. The
 * previous flow made a student select, open a popover, pick a colour
 * and watch it apply; four moments for an action they perform forty
 * times an hour.
 *
 * Note and Ask are the same: one tap each, straight from the selection
 * that is already on screen. The student never copies text anywhere.
 *
 * POSITION. Above the selection on a mouse, where the pointer already
 * is. Pinned near the bottom on a touch screen, because a bar anchored
 * to where a finger just was is a bar underneath that finger — and on
 * a phone it lands off-screen as often as not.
 */
export function SelectionBar({
  anchor,
  coarse,
  onHighlight,
  onNote,
  onAsk,
  onDismiss,
}: {
  anchor: { x: number; y: number };
  coarse: boolean;
  onHighlight: (color: Highlight["color"]) => void;
  onNote: () => void;
  onAsk: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const labels = t.library;

  return (
    <div
      role="toolbar"
      aria-label={labels.marks}
      className={
        "fixed z-[60] flex items-center gap-1 rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-[0_12px_40px_-8px_rgba(23,15,46,0.35)] backdrop-blur-xl " +
        (coarse
          ? "bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2"
          : "-translate-x-1/2 -translate-y-[calc(100%+12px)]")
      }
      style={coarse ? undefined : { left: anchor.x, top: anchor.y }}
    >
      {COLORS.map((colour) => (
        <button
          key={colour.key}
          onClick={() => onHighlight(colour.key)}
          aria-label={colour.key}
          className={
            "rounded-full ring-1 ring-black/10 transition active:scale-90 " +
            colour.swatch +
            (coarse ? " h-10 w-10" : " h-7 w-7")
          }
        />
      ))}

      <span className="mx-1 h-6 w-px bg-black/10" aria-hidden="true" />

      <Action label={labels.addNote} coarse={coarse} onClick={onNote}>
        <StickyNote size={coarse ? 19 : 16} />
      </Action>

      <Action label={labels.askAi} coarse={coarse} onClick={onAsk} accent>
        <Sparkles size={coarse ? 19 : 16} />
      </Action>

      <Action label={labels.cancel} coarse={coarse} onClick={onDismiss} muted>
        <X size={coarse ? 18 : 15} />
      </Action>
    </div>
  );
}

function Action({
  label,
  coarse,
  onClick,
  accent,
  muted,
  children,
}: {
  label: string;
  coarse: boolean;
  onClick: () => void;
  accent?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "flex items-center justify-center rounded-xl transition active:scale-90 " +
        (coarse ? "h-10 w-10 " : "h-8 w-8 ") +
        (accent
          ? "bg-gradient-to-br from-primary to-secondary text-white"
          : muted
            ? "text-text-muted-light hover:bg-black/5"
            : "text-text-primary-light hover:bg-black/5")
      }
    >
      {children}
    </button>
  );
}
