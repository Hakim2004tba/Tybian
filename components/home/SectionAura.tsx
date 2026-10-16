/**
 * The slow light behind a section.
 *
 * Two very large, very soft blurs that drift on a long loop. They are
 * what stops a full-width block of flat colour — the purple ones and
 * the white ones alike — from reading as a plain backdrop between the
 * cards, without adding a single image or any JavaScript.
 *
 * Rules it follows so it stays decoration and never becomes noise:
 *   - pointer-events: none and aria-hidden — it is not content
 *   - painted between the section's background and its content: the
 *     wrapper is `isolate` and this is `-z-10`, which in the CSS paint
 *     order puts it after the background and before the in-flow
 *     children. Without the negative index a positioned element paints
 *     ABOVE static content, and the blur would sit over the text.
 *   - motion-safe only, so "reduce motion" leaves a still gradient
 *   - opacity low enough that text contrast is untouched
 *   - 26s loop with an offset on the second blur, so the pair never
 *     pulses together and the movement stays below conscious notice
 *
 * `tone` picks the palette: `dark` for the deep purple sections,
 * `light` for the white ones, where the same purple at a fraction of
 * the strength reads as warmth rather than colour.
 */
export function SectionAura({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <span
        className={
          "absolute -start-[12%] -top-[25%] h-[42rem] w-[42rem] rounded-full blur-3xl motion-safe:animate-drift " +
          (dark ? "bg-primary/20" : "bg-primary/[0.07]")
        }
      />
      <span
        style={{ animationDelay: "-13s" }}
        className={
          "absolute -bottom-[30%] -end-[10%] h-[38rem] w-[38rem] rounded-full blur-3xl motion-safe:animate-drift " +
          (dark ? "bg-secondary/20" : "bg-secondary/[0.06]")
        }
      />
    </div>
  );
}
