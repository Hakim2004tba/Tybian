"use client";

import { useEffect, type RefObject } from "react";

/**
 * The touch vocabulary of the reader.
 *
 * THE RULE THAT SHAPES ALL OF IT: a gesture must never steal a scroll.
 * A reader where dragging sometimes turns the page and sometimes
 * scrolls is a reader nobody trusts, and the student stops using
 * gestures entirely. So every handler below either recognises its
 * gesture within a clear threshold or gets out of the way.
 *
 *   swipe horizontally  → previous / next page
 *   pinch               → zoom
 *   double tap          → fit width, or back to 100%
 *   two-finger tap      → show / hide the floating controls
 *
 * Vertical movement wins ties: scrolling is the common case and must
 * stay perfectly ordinary.
 */
export function useGestures({
  ref,
  enabled,
  onPrev,
  onNext,
  onZoom,
  onToggleChrome,
  onFit,
}: {
  ref: RefObject<HTMLElement | null>;
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onZoom: (factor: number) => void;
  onToggleChrome: () => void;
  onFit: () => void;
}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    /* ---- one finger: swipe between pages ---- */
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let tracking = false;

    /* ---- two fingers: pinch, and the two-finger tap ---- */
    let pinchStart = 0;
    let pinching = false;
    let twoFingerAt = 0;
    let twoFingerMoved = false;

    const distance = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 2) {
        pinchStart = distance(event.touches);
        pinching = true;
        tracking = false;
        twoFingerAt = Date.now();
        twoFingerMoved = false;
        return;
      }
      if (event.touches.length === 1) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        startAt = Date.now();
        tracking = true;
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (pinching && event.touches.length === 2) {
        const now = distance(event.touches);
        const ratio = now / (pinchStart || now);
        /*
          A 12% change before zooming. Below that, two fingers resting
          on the glass while scrolling would creep the zoom every time.
        */
        if (Math.abs(ratio - 1) > 0.12) {
          onZoom(ratio);
          pinchStart = now;
          twoFingerMoved = true;
          event.preventDefault();
        }
        return;
      }

      if (!tracking || event.touches.length !== 1) return;

      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;

      /*
        Vertical intent cancels the swipe immediately. Without this a
        slightly diagonal scroll flips the page mid-paragraph, which is
        the single most infuriating thing a reader can do.
      */
      if (Math.abs(dy) > Math.abs(dx)) tracking = false;
    }

    function onTouchEnd(event: TouchEvent) {
      if (pinching && event.touches.length === 0) {
        pinching = false;
        /* Two fingers down and up, going nowhere: a deliberate tap. */
        if (!twoFingerMoved && Date.now() - twoFingerAt < 300) onToggleChrome();
        return;
      }

      if (!tracking) return;
      tracking = false;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const elapsed = Date.now() - startAt;

      /* Far enough, straight enough, and quick enough to be a flick. */
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && elapsed < 600) {
        /*
          Direction follows the WRITING direction, not the screen.
          In Arabic the next page lives to the left, and a reader that
          ignores that feels backwards to every student using it.
        */
        const rtl = document.documentElement.dir === "rtl";
        const forward = rtl ? dx > 0 : dx < 0;
        if (forward) onNext();
        else onPrev();
      }
    }

    /* ---- double tap to fit ---- */
    let lastTapAt = 0;
    function onPointerUp(event: PointerEvent) {
      if (event.pointerType === "mouse") return;
      const now = Date.now();
      if (now - lastTapAt < 300) {
        onFit();
        lastTapAt = 0;
        return;
      }
      lastTapAt = now;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    /* Not passive: pinch has to be able to stop the browser's own zoom. */
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [ref, enabled, onPrev, onNext, onZoom, onToggleChrome, onFit]);
}
