import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton blocks must stay low-contrast and slow (1.8s) so they never
 * compete with real content once it streams in — DESIGN_SYSTEM.md §9/§15.
 * Pair with React Suspense boundaries per data-dependent card, not one
 * page-level spinner.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-sm bg-[length:400%_100%]",
        "bg-gradient-to-r from-border-light via-[#f0eef7] to-border-light",
        className
      )}
      {...props}
    />
  );
}

/** Minimal inline spinner for button/async-action states — not a page blocker. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
