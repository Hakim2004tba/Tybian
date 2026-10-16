"use client";

import { usePathname } from "next/navigation";

/**
 * Where the floating tools sit, given that a bottom tab bar exists on
 * some pages and not others.
 *
 * The bar is part of the dashboard shell only; the lesson player has no
 * such bar. Lifting the tools everywhere would leave a 72px hole above
 * nothing on the lesson page, and not lifting them at all would bury
 * the lowest one behind the bar on the dashboard. So the offset follows
 * the route.
 *
 * Whole class names, never assembled from pieces: Tailwind finds
 * classes by reading source text, and a name built at runtime is never
 * generated — a lesson this codebase has already learned once, when a
 * helper returning `${side}-4` silently positioned nothing.
 */
export function useFloatingOffsets() {
  const pathname = usePathname();
  const hasTabBar = pathname.startsWith("/dashboard");

  return {
    /* 72px bar + the same gap the tools use without it. */
    timer: hasTabBar ? "bottom-[6rem] lg:bottom-6" : "bottom-6",
    sketch: hasTabBar ? "bottom-[10.25rem] lg:bottom-[5.75rem]" : "bottom-[5.75rem]",
    assistant: hasTabBar ? "bottom-[14.5rem] lg:bottom-[10rem]" : "bottom-[10rem]",
    panel: hasTabBar ? "bottom-[18.75rem] lg:bottom-[14.25rem]" : "bottom-[14.25rem]",
  };
}
