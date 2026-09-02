/**
 * Minimal, dependency-free SVG line+area chart. Single-hue violet per
 * DESIGN_SYSTEM.md §9 ("charts single-hue, opacity variation for
 * series") — no chart library, matches the "no unnecessary heavy
 * dependency" constraint from earlier phases.
 */
export function AreaLineChart({
  points,
  height = 180,
}: {
  points: { label: string; value: number }[];
  height?: number;
}) {
  if (points.length === 0) {
    return <EmptyChart height={height} />;
  }

  const width = 600;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = width / (points.length - 1 || 1);

  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: height - (p.value / max) * (height - 20) - 4,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6C4CF1" stopOpacity="0.22" />
            <stop offset="1" stopColor="#6C4CF1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#E4E1EF" />
        <path d={areaPath} fill="url(#areaFill)" />
        <path d={linePath} fill="none" stroke="#6C4CF1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="#6C4CF1" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-text-muted-light">
        {points.map((p) => (
          <span key={p.label} className="num">{p.label}</span>
        ))}
      </div>
    </div>
  );
}

export function EmptyChart({ height = 180 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-md border border-dashed border-border-light text-[13px] text-text-muted-light"
    >
      لا توجد بيانات كافية بعد
    </div>
  );
}
