import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** "content" = 1440px app-wide max width. "reading" = 1200px text column
   * for long-form/lesson content — see DESIGN_SYSTEM.md §5. */
  width?: "content" | "reading";
}

export function Container({ className, width = "content", ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-md md:px-xl",
        width === "content" ? "max-w-content" : "max-w-reading",
        className
      )}
      {...props}
    />
  );
}
