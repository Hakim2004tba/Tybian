import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "violet" | "teal" | "gold" | "success" | "error" | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  violet: "bg-primary/10 text-primary",
  teal: "bg-secondary/15 text-[#0f9c86]",
  // Gold badge = premium/commerce signal only (lifetime plan, certificate).
  gold: "bg-gold/15 text-[#96721f]",
  success: "bg-success/15 text-[#1e8a56]",
  error: "bg-error/10 text-error",
  muted: "bg-text-muted-light/15 text-text-muted-light",
};

export function Badge({ className, variant = "violet", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
