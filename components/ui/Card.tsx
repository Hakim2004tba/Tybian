import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** dark = Surface(dark) card for dark-theme contexts (landing, login, video). */
  tone?: "light" | "dark";
  /** Adds the standard lg-padding + hover lift used across course/stat cards. */
  interactive?: boolean;
  padded?: boolean;
}

/**
 * Base card surface. Dark cards never use box-shadow (see DESIGN_SYSTEM.md
 * §7) — elevation on dark surfaces comes from border-color + optional glow
 * utility applied by the consumer, not from this component.
 */
export function Card({
  className,
  tone = "light",
  interactive = false,
  padded = true,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        tone === "light"
          ? "bg-surface-light border-border-light shadow-md text-text-primary-light"
          : "bg-surface-dark border-border-dark text-text-primary-dark",
        padded && "p-lg",
        interactive &&
          "transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-primary hover:shadow-lg",
        className
      )}
      {...props}
    />
  );
}
