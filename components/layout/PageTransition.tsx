"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps every page's content in root layout. Keying on `pathname` makes
 * React remount this div on every navigation, retriggering the CSS
 * animation — a lightweight page-transition without a routing library.
 * `prefers-reduced-motion` is already handled globally in globals.css
 * (kills all animation-duration site-wide), so no extra check needed
 * here.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
