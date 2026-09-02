import { EmptyChart } from "@/components/admin/charts/AreaLineChart";

export function HorizontalBarList({
  items,
}: {
  items: { label: string; value: number; sublabel?: string }[];
}) {
  if (items.length === 0) return <EmptyChart height={160} />;

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between text-[13.5px]">
            <span className="truncate">{item.label}</span>
            <span className="num shrink-0 text-text-muted-light">{item.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border-light">
            <div
              className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover"
              style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
