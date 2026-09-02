import { EmptyChart } from "@/components/admin/charts/AreaLineChart";

export function BarChart({
  bars,
  height = 180,
  valueFormatter,
}: {
  bars: { label: string; value: number }[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  if (bars.length === 0) return <EmptyChart height={height} />;

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {bars.map((b) => {
          const h = Math.max((b.value / max) * (height - 8), 4);
          return (
            <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="num text-[11px] text-text-muted-light">
                {valueFormatter ? valueFormatter(b.value) : b.value}
              </span>
              <div
                style={{ height: h }}
                className="w-full rounded-t-sm bg-gradient-to-t from-primary to-primary-hover"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 text-[11px] text-text-muted-light">
        {bars.map((b) => (
          <span key={b.label} className="num flex-1 text-center">{b.label}</span>
        ))}
      </div>
    </div>
  );
}
