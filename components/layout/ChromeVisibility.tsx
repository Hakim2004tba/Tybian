"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Shows or hides chrome based on the CURRENT path.
 *
 * WHY THIS EXISTS: the root layout is a server component. Next renders
 * it once per full page load and does NOT re-run it during client-side
 * navigation — so a decision made there from the middleware's
 * `x-pathname` header freezes at whatever the first page was. That is
 * why the study tools failed to appear until a manual refresh after
 * login, and vanished after moving from a course page back to the
 * dashboard: the layout still believed it was on the old route.
 *
 * usePathname() re-evaluates on every navigation, so visibility follows
 * the student instead of lagging a page behind. The children stay
 * server components — passing them through a client wrapper does not
 * make them client code.
 */
export function ChromeVisibility({
  children,
  /** Path prefixes on which the children should render. */
  showOn,
  /** Path prefixes on which they should be hidden (wins over showOn). */
  hideOn,
}: {
  children: ReactNode;
  showOn?: string[];
  hideOn?: string[];
}) {
  const pathname = usePathname();

  if (hideOn?.some((prefix) => pathname.startsWith(prefix))) return null;
  if (showOn && !showOn.some((prefix) => pathname.startsWith(prefix))) return null;

  return <>{children}</>;
}
