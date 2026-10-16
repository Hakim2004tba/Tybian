"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a slide-in drawer out of the DOM while it is closed, without
 * losing the open or close animation.
 *
 * THE BUG THIS FIXES: a closed drawer used to stay mounted, pushed out of
 * sight with `translate-x-full` on a `position: fixed` box. On a desktop
 * browser that is invisible, because the root carries `overflow-x:
 * hidden`. On a phone it is not: `overflow-x: hidden` on the root does
 * not contain fixed-position descendants, so mobile browsers grew the
 * layout viewport by the drawer's own 308px and let the page pan
 * sideways. Every page then read as "shifted right and cut off at the
 * edge" — which is exactly what it looked like on a real phone, and
 * exactly what no desktop check would ever reveal.
 *
 * `present` says whether to render at all; `shown` says whether it is in
 * its open position. The gap between them is what makes the animation
 * possible: on open we mount first and slide on the next frame (a box
 * mounted already-open has nothing to transition from), and on close we
 * slide first and unmount once the transition has had time to finish.
 *
 * `durationMs` must match the CSS transition duration. Too short and the
 * drawer vanishes mid-slide; too long and the phone keeps the extra
 * scroll width for that much longer after closing.
 */
export function useDrawerPresence(open: boolean, durationMs = 200) {
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);

      /*
        Two frames: one for the browser to lay the drawer out in its
        closed position, one for the class change to read as a
        transition rather than the initial paint.

        The timer beside them is not belt-and-braces — browsers stop
        firing animation frames in a background tab, and without it a
        menu opened in a tab that is not on screen stays parked
        off-screen until the tab is looked at. Whichever lands first
        wins; the second call is a no-op.
      */
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      const fallback = setTimeout(() => setShown(true), 50);

      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
        clearTimeout(fallback);
      };
    }

    setShown(false);
    const timer = setTimeout(() => setPresent(false), durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs]);

  return { present, shown };
}
