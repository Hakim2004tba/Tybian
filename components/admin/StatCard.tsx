import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  tone = "violet",
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  trend?: { value: string; direction: "up" | "down" };
  tone?: "violet" | "teal" | "gold" | "success";
}) {
  const toneClasses: Record<string, string> = {
    violet: "bg-primary/10 text-primary",
    teal: "bg-secondary/15 text-[#0f9c86]",
    gold: "bg-gold/15 text-[#96721f]",
    success: "bg-success/15 text-[#1e8a56]",
  };

  return (
    <Card className="flex items-start gap-3.5">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
        <Icon size={20} strokeWidth={1.6} />
      </div>
      <div>
        <div className="num text-[26px] font-bold leading-tight">{value}</div>
        <div className="text-[13px] text-text-muted-light">{label}</div>
        {trend && (
          <div
            className={cn(
              "num mt-1 text-[12px] font-semibold",
              trend.direction === "up" ? "text-success" : "text-error"
            )}
          >
            {trend.direction === "up" ? "↑" : "↓"} {trend.value}
          </div>
        )}
      </div>
    </Card>
  );
}
