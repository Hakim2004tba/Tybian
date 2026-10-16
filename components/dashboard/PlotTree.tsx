/**
 * One tree on the study plot.
 *
 * Two states and nothing between them: dark ground, or lit. A tree that
 * "partly" lights would make two hours of real study look like half an
 * achievement — the progress toward the NEXT tree is shown as a bar
 * instead, where a fraction belongs.
 *
 * Drawn rather than illustrated so twenty of them cost one SVG each and
 * stay sharp at any size.
 */
export function PlotTree({ lit, index }: { lit: boolean; index: number }) {
  return (
    <span className="relative flex aspect-square items-end justify-center">
      {/* The glow. Only under a lit tree, and soft enough that a full
          plot does not turn into one bright smear. */}
      {lit && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 h-[70%] w-[70%] rounded-full bg-gold/35 blur-lg"
        />
      )}

      <svg viewBox="0 0 40 46" className="relative h-full w-full" aria-hidden>
        {/* ground */}
        <ellipse cx="20" cy="42" rx="11" ry="3" fill={lit ? "rgba(232,163,61,0.22)" : "rgba(23,15,46,0.07)"} />
        {/* trunk */}
        <rect
          x="18.4"
          y="27"
          width="3.2"
          height="14"
          rx="1.6"
          fill={lit ? "#8A5A2B" : "rgba(23,15,46,0.16)"}
        />
        {/* canopy — three overlapping rounds read as a tree at 24px,
            where a detailed one reads as a blob */}
        <g fill={lit ? "url(#litLeaf)" : "rgba(23,15,46,0.11)"}>
          <circle cx="20" cy="15" r="9.5" />
          <circle cx="13" cy="22" r="7.5" />
          <circle cx="27" cy="22" r="7.5" />
        </g>
        <defs>
          <linearGradient id="litLeaf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7D774" />
            <stop offset="55%" stopColor="#E8A33D" />
            <stop offset="100%" stopColor="#3FA96B" />
          </linearGradient>
        </defs>
      </svg>

      {/* The number is what turns a decoration into a count: a student
          can see they are on the eleventh of twenty. */}
      <span
        className={
          "absolute -bottom-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none " +
          (lit ? "bg-white text-text-primary-light shadow-sm" : "bg-black/[0.06] text-text-muted-light")
        }
      >
        <span className="num">{index}</span>
      </span>
    </span>
  );
}
