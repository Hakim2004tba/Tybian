"use client";

import { useEffect, useState } from "react";

/**
 * Which of the three interaction models this device gets.
 *
 * Not "is the screen small" — three genuinely different products share
 * one codebase here, and the difference is how a person's hand reaches
 * the screen:
 *
 *   desktop  a pointer, a keyboard, room for a persistent rail
 *   tablet   a hand or a pen, held; the document IS the screen
 *   phone    a thumb, one-handed, reachable only at the bottom
 *
 * The old reader had one layout and shrank it, which is why it felt
 * like a desktop PDF viewer squeezed onto an iPad.
 *
 * Breakpoints are read from matchMedia rather than window.innerWidth so
 * a rotation updates without a resize listener firing on every frame.
 */
export type ReaderLayout = "desktop" | "tablet" | "phone";

export type LayoutInfo = {
  layout: ReaderLayout;
  landscape: boolean;
  /** A finger or a pen — no hover, bigger targets, gestures matter. */
  coarse: boolean;
  /** Set once a pen is actually used; the UI leans into it. */
  pen: boolean;
  /** Rendered on the server / before hydration. */
  ready: boolean;
};

export function useLayout(): LayoutInfo {
  const [info, setInfo] = useState<LayoutInfo>({
    layout: "desktop",
    landscape: true,
    coarse: false,
    pen: false,
    ready: false,
  });

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)");
    const medium = window.matchMedia("(min-width: 768px)");
    const landscape = window.matchMedia("(orientation: landscape)");
    const coarse = window.matchMedia("(pointer: coarse)");

    const read = () =>
      setInfo((prev) => ({
        /*
          A large screen with a coarse pointer is a tablet, not a
          desktop — a 12.9" iPad is wider than many laptops and must
          not inherit hover-dependent chrome.
        */
        layout: wide.matches && !coarse.matches ? "desktop" : medium.matches ? "tablet" : "phone",
        landscape: landscape.matches,
        coarse: coarse.matches,
        pen: prev.pen,
        ready: true,
      }));

    read();
    for (const query of [wide, medium, landscape, coarse]) {
      query.addEventListener("change", read);
    }

    /*
      A pen announces itself only by being used. Listening once, at the
      document level, avoids every page component having to care —
      and `once` means the listener costs nothing after the first
      stroke.
    */
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "pen") setInfo((prev) => ({ ...prev, pen: true }));
    };
    document.addEventListener("pointerdown", onPointer);

    return () => {
      for (const query of [wide, medium, landscape, coarse]) {
        query.removeEventListener("change", read);
      }
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return info;
}
