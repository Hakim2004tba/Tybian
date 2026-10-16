"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine } from "lucide-react";
import { SketchStudio } from "@/components/sketch/SketchStudio";
import type { SketchDocument } from "@/lib/sketch/model";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useFloatingOffsets } from "@/lib/ui/floating-offsets";

type StoredSketch = {
  id: string;
  title: string;
  contextLabel: string | null;
  updatedAt: string;
  document: SketchDocument;
};

/**
 * The floating entry point to the sketch notebook.
 *
 * Part of the left-edge dock: study timer at the bottom, then this,
 * then the AI assistant. The sidebar owns the right edge in this RTL
 * layout, so nothing floats there.
 *
 * The notebook is fetched only when the student first opens it: someone
 * who never draws should not pay for the query on every page load.
 *
 * `document.title` becomes the sketch's context label, so a diagram
 * drawn while reading a lesson is filed under that lesson's name and is
 * recognisable in the gallery weeks later.
 */
export function SketchLauncher() {
  const pathname = usePathname();
  const { t } = useI18n();
  const offsets = useFloatingOffsets();
  const [open, setOpen] = useState(false);
  const [sketches, setSketches] = useState<StoredSketch[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function launch() {
    if (sketches) {
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sketches");
      const data = res.ok ? await res.json() : { sketches: [] };
      setSketches(data.sketches ?? []);
      setOpen(true);
    } catch {
      // An unreachable notebook should still let the student draw —
      // opening with an empty gallery is better than a dead button.
      setSketches([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  const contextLabel =
    typeof document !== "undefined" && pathname.includes("/courses/")
      ? document.title.replace(/\s*[|—-]\s*(?:تبيان|TIBYAN).*$/i, "").trim() || null
      : null;

  return (
    <>
      <button
        type="button"
        onClick={launch}
        disabled={loading}
        aria-label={t.sketch.title}
        title={t.sketch.title}
        className={cn("ai-dock-shift group fixed end-6 z-50 md:end-8 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#F5C451] via-[#E8A33D] to-[#C97A22] text-academy-deep shadow-[0_10px_30px_-6px_rgba(232,163,61,0.75)] ring-1 ring-[#FFE7AE]/60 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 print:hidden", offsets.sketch)}
      >
        <span className="flex flex-col items-center leading-none">
          <PenLine size={17} className="transition-transform group-hover:-rotate-12" />
          <span className="mt-0.5 text-[9.5px] font-bold tracking-wide">{t.sketch.short}</span>
        </span>
        <span
          className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[#E8A33D]/45 blur-lg"
          aria-hidden="true"
        />
      </button>

      {open && sketches && (
        <SketchStudio
          initialSketches={sketches}
          contextLabel={contextLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
